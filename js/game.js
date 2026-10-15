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
function rarityText(tier,chance){return "1 in "+(chance||chanceOf(tier));}
/* Peluang efektif sebuah kartu: tiap lapisan kelangkaan mengali penyebut sesuai pengali stat-nya.
   SHINY ×2, mutasi ×MUT_MULT (gold 5 / rainbow 10 / secret 25). Mis. secret dari kartu 800k = 1 in 20M. */
function effChance(charId,mut,shiny){const c=CARDS[charId]||{};const ch=c.chance||chanceOf(c.tier);return ch*(shiny?SHINY_MULT:1)*(MUT_MULT[mut]||1);}
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
  {id:"tameng-surgawi",name:"TAMENG SURGAWI",icon:"tameng-surgawi",color:"#fde68a",src:"coin", price:1000000000,flat:50, pct:200, img:"assets/artifacts/tameng-surgawi.png"}
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
  {id:"next-bot",    name:"NEXT-BOT",       img:"assets/pets/next-bot.png",   emoji:"🤖",src:"coin", price:5000000000,flat:120,pct:150}
];
function luckTxt(d){const a=[];if(d.flat)a.push("+"+d.flat+" FLAT");if(d.pct)a.push("+"+d.pct+"%");return a.join(" & ")+" LUCK";}
function artLuckFlat(){return state&&Array.isArray(state.artSlots)?state.artSlots.reduce((a,id)=>a+((ART_DEFS.find(x=>x.id===id)||{}).flat||0),0):0;}
function artLuckPct(){return state&&Array.isArray(state.artSlots)?state.artSlots.reduce((a,id)=>a+((ART_DEFS.find(x=>x.id===id)||{}).pct||0),0):0;}
function petLuckFlat(){const d=state&&state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;return d?(d.flat||0):0;}
function petLuckPct(){const d=state&&state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;return d?(d.pct||0):0;}
function totalLuck(){const p=state?.player||{};const base=p.luckBase??p.luck??1;const flat=(p.luckFlat||0)+treeLuckFlat()+activeLuckBuff()+artLuckFlat()+petLuckFlat();const pct=(p.luckPercent||0)+treeLuckPct()+activeLuckBuffPct()+artLuckPct()+petLuckPct();return (base+flat)*(1+pct)*weatherLuckMult();}
// Chance yang ditampilkan ke user = base × statMult (MENTAH, TIDAK dibagi luck) — biar kerasa "wah 1 in 18 juta".
// Sistem luck TETAP jalan di belakang layar (ngaruh ke bobot roll rngRoll + keliatan di Profil), cuma angkanya saja yang shown raw.
function luckChance(charId,mut,shiny){return effChance(charId,mut,shiny);}
/* =============== STORY BIBLE ===============
   Satu-satunya tempat data karakter & alur story.
   CARDS, FOES, pool gacha, dan stat musuh diturunkan otomatis dari blok ini. */
const STORY_BIBLE={
  chapters:[{no:1, zone:"NINJA VILLAGE", tag:"STORY · BAB 1",
    art:"assets/images/story-bab1-ninja.png",
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
  {no:2, zone:"GREEN PLANET", tag:"STORY · BAB 2",
    art:"assets/images/story-bab2-green-planet.png",
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
  {no:3, zone:"SHIBUYA STATION", tag:"STORY · BAB 3",
    art:"assets/images/story-bab3-shibuya.png",
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
  {no:4, zone:"MUSHIMA TOWN", tag:"STORY · BAB 4",
    art:"assets/images/story-bab4-trost.webp",
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
  {no:5, zone:"INFINITY CASTLE", tag:"STORY · BAB 5",
    art:"assets/images/story-bab5-infinity-castle.webp",
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
        art:"assets/cards/art/slug.png", fx:{double:15},
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
    havocRocket:{every,pct} -> (HAVOC WREACKER) playerPhase, counter bt.hvCount[a] tiap serangan: setiap serangan ke-`every` -> damage FLAT pct% ATK ke musuh AKTIF + pancar ke SELURUH slot CADANGAN tower via lineupAoeHit (cadangan kehabisan HP -> w.dead / mati).
    getExcited:1 -> (HAVOC WREACKER) foeDown blok freezeTransfer: kartu ini membunuh -> bt.excited=true; di akhir advanceTowerFoe jadwal diganti playerPhase (serangan ekstra) alih-alih enemyPhase.
    rewind:{pct,stun} -> (TIME TRICKSTER) trySave sebelum blok revive, sekali via bt.revUsed: heal pct% max HP + damage musuh SEJUMLAH heal itu + stun stun giliran (guard statusImmune). Kalau lethal, playerPhase berikutnya langsung foeDown (guard eHp<=0).
    turret:{start,every,atkPct,blockPct} -> (YORDLE INVENTOR) arming entry 4 titik: bt.turret=start. playerPhase: tiap every giliran +1 turret (guard bt.turretTurn); serangan: dmgMult*=(1+turret*atkPct/100). enemyPhase: kena hit & random<blockPct -> etotal=0 + turret-- (hancur).
    lineupAoeHit(dmg) -> helper (dekat advanceTowerFoe): TOWER ONLY. Loop waves sisa idx+1: lazy w.hp-=dmg; w.hp<=0 -> w.dead (dilewati advanceTowerFoe, rail KO + bar HP). Re-render .foe-rail + float. Foe AKTIF tidak disentuh (caller sudah).
    worldEnder:{cyc1,cyc2,pierce,healPct,revive:{dr}} -> (DARKIN LORD) playerPhase blok hits (setelah const hits): counter bt.weCount[a] mod 3 -> serangan 1 x cyc1; serangan 2 x cyc2 + lineupAoeHit ke seluruh cadangan; serangan 3 x pierce + lineupNextHit ke cadangan di belakang musuh. Lifesteal: heal healPct% dari total damage giliran ini (total+weExtra), x1.3 setelah revive. trySave blok custom sebelum fx.revive: kematian PERTAMA (revUsed) -> full HP + bt.pDr=dr permanen (pDrTurns 9999) + weRevived.
    psychicBarrage:{rocks,mult,streakPct,reviveRocks} -> (PSYCHIC ESPER) playerPhase blok hits: ganti serangan jadi N batu (bt.pbRocks||rocks) @ mult; tiap batu pilih target - 50% musuh AKTIF (masuk shots) / 50% cadangan tower acak (damage langsung w.hp, rail refresh); streak target sama berturut-turut -> +streakPct% per batu (bt.pbKey/bt.pbStreak). Semua batu jatuh ke cadangan -> push mult 0 biar pipeline crit gak crash. trySave custom: kematian PERTAMA -> full HP + bt.pbRocks=reviveRocks.
    rubberField:{drPct,bouncePct,dizzyPct,dizzyTurns} -> (SUN GOD) arming 4 titik ASSIGNMENT bt.rubber=!!fxX.rubberField (ikut mati pas tag-out). enemyPhase setelah blok dmgCut: etotal dipotong 50% + rbBounce=separuhnya; penyerang kena DIZZY (guard statusImmune): dizzyStack++ + dizzyLeft=9. Setelah hit (dekat royalNow counter): rbBounce dipukulkan balik ke musuh, bisa foeDown. playerPhase blok dmgMult: x(1+dizzyStack*0.2) selama dizzyLeft>0. Tick tiap awal enemyPhase; advanceTowerFoe reset semua.
    lineupNextHit(dmg) -> helper (sebelum lineupAoeHit): TOWER ONLY. damage FLAT ke cadangan tower terdepan yang masih hidup (w.hp lazy-init -> w.dead); story no-op. Re-render .foe-rail + float PIERCE.
       ==================================================== */
    {id:"CH_RULER",name:"RULER",tier:"EX",type:"Absolute",skill:"VENUZDONOA",hp:4787,atk:2394,chance:850000000,art:"assets/cards/art/ruler.webp",
      fx:{revive:1,dmgMult:2,ignoreDef:1},
      desc:"Saat mati, bangkit dengan 100% HP (sekali). Semua serangan memberikan 2x damage. Efek pengurangan damage musuh diabaikan sepenuhnya. Tidak dapat terkena efek status apapun."},
    {id:"CH_OTHERWORLDLY",name:"OTHERWORLD",tier:"EX",type:"Ultra Instinct",skill:"ULTRA INSTINCT: ONE PERCENT",hp:5120,atk:2560,chance:1000000000,art:"assets/cards/art/otherworldly-being.png",
      fx:{dodgeAtk:{chance:60,pct:15,max:3},everySecond:{mult:2},lastStand:{pct:15}},
      desc:"60% kesempatan menghindari serangan apapun. Setiap kali menghindar, mendapat +15% ATK permanen (menumpuk hingga 3 kali). Setiap serangan ke-2 menggunakan Satu Persen kekuatannya: memberikan 2x damage dan mengabaikan pengurangan damage. Pertama kali menerima damage fatal, bertahan dengan 1 HP dan mendapat +15% ATK."},
    {id:"CH_DEVIL_HUNTER",name:"DEVIL HUNTER",tier:"UR",type:"Style",skill:"STYLE SWITCHING",hp:4026,atk:2013,chance:450000000,art:"assets/cards/art/devil-hunter.png",
      fx:{styleSwitching:1},
      desc:"Setiap giliran berganti mode secara berurutan: TRICKSTER (menghindari serangan musuh pada giliran itu), SWORDMASTER (damage 1.5x), ROYALGUARD (menerima 50% lebih sedikit damage dan membalas 30% dari damage yang diterima), GUNSLINGER (serangan juga menghantam target berikutnya sebesar 40%)."},
    {id:"CH_NINE_TAIL",name:"NINE-TAIL PRODIGY",tier:"UR",type:"Jinchuriki",skill:"LIFE FORCE DRAIN",hp:3563,atk:1782,chance:450000000,art:"assets/cards/art/nine-tail-prodigy.png",pos:"center",
      fx:{burst:{turns:4,mult:1.75},hpDrain:{pct:12},lifetime:{turns:4}},
      desc:"Selama 4 giliran, mendapat 1.75x semua stat dan setiap serangan secara permanen mengurangi max HP musuh sebesar 12%. Setelah 4 giliran, kartu ini mati."},
    {id:"CH_SHADOW_HEIR",name:"SHADOW HEIR",tier:"UR",type:"Dojutsu",skill:"AMENOTEJIKARA / SUSANOO CHIDORI",hp:3563,atk:1782,chance:300000000,art:"assets/cards/art/shadow-heir.png",pos:"center",
      fx:{entryCounter:{mult:15},dodgeEvery:{turns:3},everyNth:{n:4,mult:3},lowHpAura:{below:30,dr:40,burn:{pct:20,turns:2}}},
      desc:"Saat masuk arena, Amenotejikara membuat serangan pertama musuh meleset dan Shadow Heir langsung melakukan counter sebesar 15x damage. Setiap 3 giliran, Shadow Heir menghindari serangan berikutnya. Setiap serangan ke-4 berubah menjadi Susanoo Chidori yang memberikan 3x damage dan mengabaikan pengurangan damage. Di bawah 30% HP, Perfect Susanoo aktif, memberikan 40% pengurangan damage dan membuat serangan membakar musuh sebesar 20% max HP selama 2 giliran."},
    {id:"CH_FABLED_SOLDIER",name:"FABLED SOLDIER",tier:"UR",type:"Vanguard",skill:"SUPERNOVA",hp:3153,atk:1577,chance:200000000,art:"assets/cards/art/fabled-soldier.png",pos:"center",
      fx:{executeOnEntry:{pct:20},dmgMult:1.3},
      desc:"Saat masuk, jika HP kartu aktif musuh saat ini kurang dari 20% dari stat Fabled Soldier, langsung hancurkan. Serangan memberikan 1.3x base damage."},
    {id:"CH_IMMORTAL_COLOSSUS",name:"IMMORTAL COLOSSUS",tier:"UR",type:"Titan",skill:"THE RUMBLING",hp:3029,atk:1515,chance:175000000,art:"assets/cards/art/immortal-colossus.png",pos:"center",
      fx:{transform:{mult:1.5},wallTitans:{every:3,pct:20},rumbling:{turns:2,pct:10}},
      desc:"Saat masuk, transform: 1.5x semua stat. Setiap 3 giliran, Wall Titans berbaris memberikan 20% dari serangan Eren ke semua kartu musuh. Saat mati, the Rumbling berlanjut selama 2 giliran lagi - musuh terkena 10% max HP per giliran bahkan setelah Eren jatuh."},
    {id:"CH_TRICKSTER_ACE",name:"TRICKSTER ACE",tier:"UR",type:"Gum",skill:"BUNGEE GUM",hp:2737,atk:1369,chance:125000000,art:"assets/cards/art/trickster-ace.png",pos:"center",
      fx:{bungeeGum:{turns:2,bonus:30}},
      desc:"Setelah diserang, tempelkan Bungee Gum ke musuh - selama 2 giliran, semua serangan Trickster Ace memberikan 30% bonus damage ke lawan tersebut. Jika lawan yang terkena gum mati, gum berpindah ke kartu musuh berikutnya yang masuk."},
    {id:"CH_UNDYING_ROGUE",name:"UNDYING ROGUE",tier:"UR",type:"Snatcher",skill:"SNATCH",hp:2195,atk:1098,chance:60000000,art:"assets/cards/art/undying-rogue.png",pos:"center",
      fx:{snatch:{pct:15}},
      desc:"Ketika Undying Rogue mengalahkan sebuah kartu, secara permanen curi 15% dari stat-nya (ATK & HP) dan tambahkan ke stat miliknya sendiri."},
    {id:"CH_SHADOW_MONARCH",name:"SHADOW MONARCH",tier:"EX",type:"Necromancer",skill:"ARISE",hp:1942,atk:971,chance:40000000,art:"assets/cards/art/shadow-monarch.png",pos:"center",
      fx:{arise:{pct:40,turns:2}},
      desc:"Saat membunuh, bangkitkan kartu yang dikalahkan sebagai bayangan dengan 40% dari stat-nya. Bayangan bertarung menggantikan posisi Shadow Monarch selama 2 giliran, atau sampai bayangan tersebut tumbang."},
    {id:"CH_ROYAL_VANGUARD",name:"ROYAL VANGUARD",tier:"UR",type:"Prince",skill:"PRIDE OF THE PRINCE",hp:1781,atk:891,chance:30000000,art:"assets/cards/art/royal-vanguard.png",pos:"center",
      fx:{prideOfPrince:{pct:25}},
      desc:"Ketika kartu apapun di party-mu mati, Royal Vanguard mendapatkan +25% serangan secara permanen (menumpuk tiap kali ada kartu party yang jatuh)."},
    {id:"CH_REGRESSOR",name:"REGRESSOR",tier:"UR",type:"Player",skill:"REGRESSION",hp:1527,atk:764,chance:18000000,art:"assets/cards/art/regressor.png",pos:"center",
      fx:{regression:{hpPct:40}},
      desc:"Saat mati, jika Regressor telah membunuh setidaknya satu kartu dalam pertarungan ini, bangkit kembali dengan 40% HP dan skill-nya di-refresh. Setiap kill menyimpan satu 'regression'; tiap kebangkitan menghabiskan satu."},
    {id:"CH_SIXFOLD_PROPHET",name:"SIXFOLD PROPHET",tier:"UR",type:"Shinobi",skill:"ALMIGHTY PUSH",hp:1352,atk:676,chance:12000000,art:"assets/cards/art/sixfold-prophet.jpg",pos:"center",
      fx:{entryShatter:{pct:20}},
      desc:"Saat masuk, berikan 20% dari total HP musuh saat ini yang tersebar merata ke semua kartu mereka sebagai damage."},
    {id:"CH_THRILLER_KING",name:"THRILLER KING",tier:"R",type:"Biokinetic",skill:"BIOKINESIS",hp:1792,atk:896,chance:10000000,art:"assets/cards/art/thriller-king.jpg",pos:"center",
      fx:{entryMaxHp:{pct:8},turnMaxHp:{pct:10},splitDeath:{pct:70,times:3}},
      desc:"Saat masuk, semua kartu musuh menerima 8% max HP sebagai damage. Setiap giliran Thriller King hidup, kartu aktif musuh menerima 10% max HP sebagai damage (keduanya tidak berpengaruh pada boss NPC). Saat mati, Thriller King terbelah dengan 70% stat miliknya dan bisa terbelah hingga 3 kali."},
    {id:"CH_THREEBLADE_RONIN",name:"THREEBLADE RONIN",tier:"UR",type:"Samurai",skill:"THREE THOUSAND WORLDS / ASHURA",hp:1240,atk:620,chance:9000000,art:"assets/cards/art/threeblade-ronin.jpg",pos:"center",
      fx:{everyNth:{n:4,mult:3,text:"ASHURA"},deathDefy:{pct:20}},
      desc:"Setiap serangan ke-4, Ashura muncul: memberikan 3x damage. Di bawah 20% HP, Threeblade Ronin menolak untuk tumbang — bertahan 1 giliran ekstra setelah mencapai 0 HP, masih bisa menyerang."},
    {id:"CH_WILDHEART_HUNTER",name:"WILDHEART HUNTER",tier:"SR",type:"Beastmaster",skill:"JAJANKEN - ROCK",hp:259,atk:130,chance:50000,art:"assets/cards/art/wildheart-hunter.jpg",pos:"center",
      fx:{desperateStrike:{below:30,mult:2.2,text:"JAJANKEN - ROCK"}},
      desc:"Di bawah 30% HP, serangan berikutnya memberikan damage 2.2x. Wildheart Hunter mati di akhir giliran."},
    {id:"CH_SUNBREATH_SWORDSMAN",name:"SUNBREATH SWORDSMAN",tier:"R",type:"Samurai",skill:"WATER BREATHING: FIRST FORM",hp:137,atk:69,chance:6000,art:"assets/cards/art/sunbreath-swordsman.jpg",pos:"center",
      fx:{openingHit:{pct:35}},
      desc:"Hit pertama melawan kartu baru manapun memberikan 35% damage lebih."},
    {id:"CH_YOUNG_SHADOW_HEIR",name:"YOUNG SHADOW HEIR",tier:"R",type:"Shinobi",skill:"FIREBALL JUTSU",hp:111,atk:56,chance:3000,art:"assets/cards/art/young-shadow-heir.jpg",pos:"center",
      fx:{burn:{chance:50,pct:8,turns:2}},
      desc:"50% chance saat menyerang untuk membakar musuh sebesar 8% max HP per giliran selama 2 giliran."},
    {id:"CH_YOUNG_SPIRIT_VESSEL",name:"YOUNG SPIRIT VESSEL",tier:"R",type:"Shinobi",skill:"SHADOW CLONE DODGE",hp:88,atk:44,chance:1400,art:"assets/cards/art/young-spirit-vessel.jpg",pos:"center",
      fx:{entryCounter:{mult:0,text:"SHADOW CLONE"}},
      desc:"Memanggil bayangan klon - menghindari serangan pertama!"},
    /* ===== KARTU EKSKLUSIF WEATHER: AWAKENED ===== */
{id:"CH_DARKIN_LORD",name:"DARKIN LORD",tier:"SSR",type:"Darkin",skill:"THE WORLD ENDER",hp:7040,atk:3520,chance:10000000,art:"assets/cards/art/darkin-lord.jpg",pos:"center",weatherOnly:"awakened",
  fx:{worldEnder:{cyc1:1.5,cyc2:0.4,pierce:0.8,healPct:30,revive:{dr:40}}},
  desc:"(Eksklusif cuaca AWAKENED) THE WORLD ENDER: serangan cycle 3 tahap - serangan 1 memberikan 150% damage, serangan 2 memberikan 40% damage ke semua musuh (slot cadangan ikut kena), serangan 3 menembus musuh dan yang di belakangnya masing-masing 80%. Heal 30% dari semua damage yang diberikan. Pertama kali mati: bangkit dengan 40% damage reduction dan heal 30% lebih banyak."},
{id:"CH_PSYCHIC_ESPER",name:"PSYCHIC ESPER",tier:"SSR",type:"Esper",skill:"PSYCHIC BARRAGE",hp:10600,atk:5340,chance:40000000,art:"assets/cards/art/psychic-esper.jpg",pos:"center",weatherOnly:"awakened",
  fx:{psychicBarrage:{rocks:5,mult:1.9,streakPct:10,reviveRocks:10}},
  desc:"(Eksklusif cuaca AWAKENED) PSYCHIC BARRAGE: alih-alih menyerang, melempar 5 batu psikis 190% damage ke musuh acak termasuk slot cadangan. Batu beruntun kena musuh yang sama menambah 10% damage per batu. Pertama kali mati: bangkit full HP dan melempar 10 batu tiap serangan."},
{id:"CH_SUN_GOD",name:"SUN GOD",tier:"SSR",type:"Sun",skill:"RUBBER FIELD",hp:9270,atk:4630,chance:25000000,art:"assets/cards/art/sun-god.jpg",pos:"center",weatherOnly:"awakened",
  fx:{rubberField:{drPct:50,bouncePct:50,dizzyPct:20,dizzyTurns:9}},
  desc:"(Eksklusif cuaca AWAKENED) RUBBER FIELD: saat masuk arena mengubah medan jadi karet - selama di arena menerima 50% lebih sedikit damage dari serangan dan 50% sisanya memantul balik ke penyerang. Penyerang jadi DIZZY: +20% damage diterima per stack selama 9 giliran. Stack menumpuk."},/* ===== KARTU EKSKLUSIF WEATHER: ICEAGE ===== */
    {id:"CH_ABSOLUTE_ZERO",name:"ABSOLUTE ZERO",tier:"SSR",type:"Frost",skill:"ICE TIME CAPSULE",hp:1690,atk:848,chance:1600000,art:"assets/cards/art/absolute-zero.jpg",pos:"center",weatherOnly:"iceage",
      fx:{entryFreeze:{turns:2,mult:2},freezeTransfer:1},
      desc:"(Eksklusif cuaca ICE AGE) Saat masuk arena, membekukan kartu aktif musuh selama 2 giliran dan memberikan 2x damage ke target yang beku. Membunuh target dalam keadaan beku memindahkan freeze ke kartu musuh berikutnya (1 giliran)."},
    {id:"CH_ICE_QUEEN",name:"ICE QUEEN",tier:"SSR",type:"Frost",skill:"MAHAPADMA - TIME FREEZE",hp:2140,atk:1070,chance:3500000,art:"assets/cards/art/ice-queen.jpg",pos:"center",weatherOnly:"iceage",
      fx:{foeEntryFreeze:{turns:1},hitFreeze:{chance:25,turns:1,mult:1.9}},
      desc:"(Eksklusif cuaca ICE AGE) Membekukan musuh 1 giliran setiap mereka masuk arena. Setiap serangan memiliki 25% chance membekukan musuh 1 giliran, dan memberikan 1.9x damage ke target yang beku."},
    /* ===== KARTU EKSKLUSIF WEATHER: ECLIPSE ===== */
    {id:"CH_THE_STRUGGLER",name:"THE STRUGGLER",tier:"SSR",type:"Berserk",skill:"BERSERKER ARMOR",hp:2510,atk:1260,chance:3500000,art:"assets/cards/art/the-struggler.jpg",pos:"center",weatherOnly:"eclipse",
      fx:{berserker:{selfDmgPct:5,atkGainPct:15,lowPct:20,undyingTurns:2,atkMult:2}},
      desc:"(Eksklusif cuaca ECLIPSE) Kehilangan 5% max HP setiap giliran, namun mendapatkan +15% ATK permanen tiap giliran (menumpuk). Saat HP di bawah 20%, BERSERKER ARMOR aktif: kebal kematian selama 2 giliran (HP boleh di bawah 0) dengan serangan 2x. Setelah 2 giliran, The Struggler tewas."},
    {id:"CH_WHITE_HAWK",name:"WHITE HAWK",tier:"SSR",type:"Divine",skill:"GODHAND CAUSALITY",hp:2800,atk:1400,chance:5000000,art:"assets/cards/art/white-hawk.jpg",pos:"center",weatherOnly:"eclipse",
      fx:{dodgeEvery:{turns:3},stripAbility:1},
      desc:"(Eksklusif cuaca ECLIPSE) Setiap kali diserang, kemampuan musuh dihapus permanen. Setiap 3 giliran, serangan musuh berikutnya dihindari dengan pasti. White Hawk selalu mengontrol medan perang."},
    /* ===== KARTU EKSKLUSIF WEATHER: ARCANE ===== */
{id:"CH_HAVOC_WREACKER",name:"HAVOC WREACKER",tier:"SSR",type:"Arcane",skill:"SUPER MEGA DEATH ROCKET",hp:8430,atk:4210,chance:25000000,art:"assets/cards/art/havoc-wreacker.jpg",pos:"center",weatherOnly:"arcane",
  fx:{havocRocket:{every:3,pct:50},getExcited:1},
  desc:"(Eksklusif cuaca ARCANE) SUPER MEGA DEATH ROCKET: setiap serangan ke-3 meledakkan 50% ATK ke seluruh lineup musuh - slot cadangan ikut kebakar dan bisa tumbang. Saat membunuh, GET EXCITED!: langsung menyerang lagi tanpa menunggu giliran musuh."},
{id:"CH_TIME_TRICKSTER",name:"TIME TRICKSTER",tier:"SSR",type:"Arcane",skill:"V-DRIVE RESONANCE",hp:7230,atk:3610,chance:15000000,art:"assets/cards/art/time-trickster.jpg",pos:"center",weatherOnly:"arcane",
  fx:{rewind:{pct:75,stun:1}},
  desc:"(Eksklusif cuaca ARCANE) V-DRIVE RESONANCE: saat mati, bangkit dengan 75% max HP (sekali), langsung menghantam musuh sebesar HP yang dipulihkan, dan memstun musuh 1 giliran."},
{id:"CH_YORDLE_INVENTOR",name:"YORDLE INVENTOR",tier:"SSR",type:"Arcane",skill:"EVOLUTION TURRET",hp:7630,atk:3810,chance:18000000,art:"assets/cards/art/yordle-inventor.jpg",pos:"center",weatherOnly:"arcane",
  fx:{turret:{start:2,every:3,atkPct:25,blockPct:40}},
  desc:"(Eksklusif cuaca ARCANE) EVOLUTION TURRET: saat masuk arena memanggil 2 turret, bertambah 1 setiap 3 giliran. Setiap turret memberi +25% ATK. Saat terkena serangan, 40% chance turret menahan seluruh damage (1 turret hancur)."},/* ===== KARTU EKSKLUSIF WEATHER: GOOFY ===== */
    {id:"CH_DUMB_HAIR_GUY",name:"DUMB HAIR GUY",tier:"SSR",type:"Goofy",skill:"SENZU MUNCH",hp:5540,atk:2770,chance:13000000,art:"assets/cards/art/dumb-hair-guy.jpg",pos:"center",weatherOnly:"goofy",
      fx:{senzu:{healPct:25,every:3,eatMult:0.5,strikeMult:4,atkGain:25,hpGain:50,maxMult:10}},
      desc:"(Eksklusif cuaca GOOFY) Won't stop eating: heal 25% Max HP setiap giliran, tapi serangan hanya memberikan 0.5x damage selama makan. Setiap 3 giliran selesai makan: serangan unmissable 4x strike, lalu serapan senzu memberikan +25% dari damage sebagai ATK dan +50% sebagai Max HP (hingga 10x stats dasar). Kemudian mulai makan lagi."},
    {id:"CH_DUMB_STRETCHY_GUY",name:"DUMB STRETCHY GUY",tier:"SSR",type:"Goofy",skill:"GOMU GOMU NO... WAIT WHAT?",hp:5120,atk:2560,chance:13000000,art:"assets/cards/art/dumb-stretchy-guy.jpg",pos:"center",weatherOnly:"goofy",
      fx:{stretch:{balloon:{reflect:50},fireworks:{mult:0.5},flop:{healPct:40}}},
      desc:"(Eksklusif cuaca GOOFY) Setiap serangan trigger salah satu kekacauan: Gum-Gum Balloon (serangan meleset, tapi reflect 50% damage dari hit musuh berikutnya), Gum-Gum Fireworks (pukul semua musuh sebesar 50% ATK), atau Gum-Gum Flop (miss tapi heal 40% Max HP)."},
    /* ===== KARTU EKSKLUSIF WEATHER: GLITCH ===== */
    {id:"CH_GLITCHED_ENTITY",name:"GLITCHED ENTITY",tier:"SSR",type:"Corruption",skill:"CORRUPTED DATA",hp:4180,atk:2090,chance:8000000,art:"assets/cards/art/glitched-entity.jpg",pos:"center",weatherOnly:"glitch",
      fx:{dupEntry:1,maxCorrupt:{pct:8},statusImmune:1},
      desc:"(Eksklusif cuaca GLITCH) Saat masuk arena, data terduplikasi: stat HP dan ATK menjadi 2x. Setiap serangan yang mengenai musuh merusak Max HP mereka 8% secara permanen (bisa menumpuk). Kebal terhadap semua status negatif."},
    {id:"CH_THE_GRIEFER",name:"THE GRIEFER",tier:"SSR",type:"Troll",skill:"WORLD CORRUPTION",hp:5160,atk:2580,chance:16000000,art:"assets/cards/art/the-griefer.jpg",pos:"center",weatherOnly:"glitch",
      fx:{worldCorrupt:{every:3,pct:200,dmgUp:10},deathRear:{hpPct:50},grieferAtk:{mult:1.5}},
      desc:"(Eksklusif cuaca GLITCH) Saat masuk arena, kemampuan musuh ter-corrupt: setiap 3 giliran, musuh glitch dan menghantam dirinya sendiri sebesar 200% ATK The Griefer, sementara seluruh party mendapat +10% damage untuk sisa battle. Serangan The Griefer memberikan 1.5x damage. Pertama kali tumbang, ia di-remove dari lineup dan kembali di belakang kartu terakhirmu dengan 50% HP."},
    /* ===== KARTU EKSKLUSIF WEATHER: DOODLE ===== */
    {id:"CH_HEIGHT_OF_PAINTING",name:"HEIGHT OF PAINTING",tier:"SSR",type:"Painter",skill:"TWILIGHT OF VALHALLA",hp:3670,atk:1840,chance:7000000,art:"assets/cards/art/height-of-painting.jpg",pos:"center",weatherOnly:"doodle",
      fx:{valhalla:{turns:4,dmgCut:60,atkPct:15,healPct:40,master:{mult:3,stun:1}}},
      desc:"(Eksklusif cuaca DOODLE) Saat masuk arena, Twilight of Valhalla aktif selama 4 giliran: menerima 60% damage reduction, +15% ATK setiap giliran, dan HP tidak dapat jatuh di bawah 1. Saat lukisan berakhir, memulihkan 40% max HP. Setiap serangan ke-3 adalah Masterpiece: 3x damage dan menstun musuh 1 giliran."},
    {id:"CH_INK_ANAMLOY",name:"INK ANAMLOY",tier:"SSR",type:"Demon",skill:"THE INK DEMON",hp:3420,atk:1710,chance:3500000,art:"assets/cards/art/ink-anamloy.jpg",pos:"center",weatherOnly:"doodle",
      fx:{dmgCut:{pct:30},inkCorrupt:{pct:10,max:5},inkDrain:{pct:50,every:3},revive:{pct:50,stun:1}},
      desc:"(Eksklusif cuaca DOODLE) Menerima 30% damage reduction selama di arena. Setiap serangan yang menaikkan Ink Corruption mengurangi Attack musuh 10% permanen (maksimal 5 stack). Setiap serangan ke-3 memulihkan 50% dari damage yang diberikan. Saat mati, sekali bangkit dengan 50% HP dan menstun musuh 1 giliran."},
    /* ===== KARTU EKSKLUSIF WEATHER: WINDY ===== */
    {id:"CH_BLIZZARD_BADDIE",name:"BLIZZARD BADDIE",tier:"SR",type:"Frost",skill:"PSYCHIC BLIZZARD",hp:350,atk:175,chance:80000,art:"assets/cards/art/blizzard-baddie.jpg",pos:"center",weatherOnly:"windy",
      fx:{psychicBarrier:{dr:30,turns:3,healPct:10}},
      desc:"(Eksklusif cuaca WINDY) Saat masuk arena, membuat psychic barrier yang mengurangi damage 30% selama 3 giliran. Setiap serangan yang diredam barrier memulihkan 10% max HP."},
    {id:"CH_PAPER_PAL",name:"PAPER PAL",tier:"SR",type:"Trickster",skill:"PAPER STORM",hp:272,atk:136,chance:50000,art:"assets/cards/art/paper-pal.jpg",pos:"center",weatherOnly:"windy",
      fx:{entryAtkPct:{pct:10},crit:{chance:25,mult:1.5}},
      desc:"(Eksklusif cuaca WINDY) Saat masuk arena, serpihan kertas memberikan 10% ATK ke semua kartu musuh. Serangan memiliki 25% chance menembus dengan 1.5x damage."},
    /* ===== KARTU EKSKLUSIF WEATHER: LIGHTRAIN ===== */
    {id:"CH_BLESSED_MAGE",name:"BLESSED MAGE",tier:"SR",type:"Mystic",skill:"SPIRIT OF ZEPHYR",hp:379,atk:190,chance:150000,art:"assets/cards/art/blessed-mage.jpg",pos:"center",weatherOnly:"lightrain",
      fx:{transform:{mult:1.2},everyNth:{n:2,mult:2,text:"SPIRIT DIVE"}},
      desc:"(Eksklusif cuaca LIGHTRAIN) Mendapat 20% tambahan semua stat sepanjang pertarungan. Setiap 2 giliran, Spirit Dive aktif: serangan berikutnya memberikan 2x damage."},
    {id:"CH_THUNDER_PRODIGY",name:"THUNDER PRODIGY",tier:"SR",type:"Stormcaller",skill:"THUNDERCLAP FLASH",hp:438,atk:219,chance:150000,art:"assets/cards/art/thunder-prodigy.jpg",pos:"center",weatherOnly:"lightrain",
      fx:{sleepStrike:{turns:1,mult:4,text:"THUNDERCLAP FLASH"}},
      desc:"(Eksklusif cuaca LIGHTRAIN) Tertidur 1 giliran saat masuk arena. Serangan pertama setelah bangun memberikan 4x damage, dan kelebihan damage yang membunuh target mengenai musuh berikutnya."},
    /* ===== KARTU EKSKLUSIF WEATHER: SNOWFALL ===== */
    {id:"CH_10TH_CAPTAIN",name:"10TH CAPTAIN",tier:"SR",type:"Frost",skill:"BANKAI: DAIGUREN HYORINMARU",hp:435,atk:218,chance:175000,art:"assets/cards/art/10th-captain.jpg",pos:"center",weatherOnly:"snowfall",
      fx:{entryFreeze:{turns:2,mult:1.5},iceShell:20},
      desc:"(Eksklusif cuaca SNOWFALL) Saat masuk arena, bekukan kartu aktif musuh selama 2 giliran. Selama musuh beku, serangan memberikan 1.5x damage. Selalu menerima 20% pengurangan damage (ice shell)."},
    {id:"CH_OCEANS_GUARDIAN",name:"OCEAN'S GUARDIAN",tier:"SR",type:"Tideborn",skill:"FISH-MAN KARATE: VAGABOND DRILL",hp:831,atk:416,chance:500000,art:"assets/cards/art/oceans-guardian.jpg",pos:"center",weatherOnly:"snowfall",
      fx:{heavyRain:{turns:3,healPct:20},shockwave:{every:3,pct:15}},
      desc:"(Eksklusif cuaca SNOWFALL) Saat masuk arena, hujan deras selama 3 giliran: memulihkan 20% max HP setiap giliran selama hujan. Setiap serangan ke-3 mengirimkan shockwave 15% ATK ke kartu aktif musuh."},
      /* ===== KARTU EKSKLUSIF WEATHER: THUNDERSTORM (baru - engine passives: timeStop/killHeal/tripleHit/flood) ===== */
      {id:"CH_IMMORTAL_VAMPIRE",name:"IMMORTAL VAMPIRE",tier:"SR",type:"Voidkeeper",skill:"THE WORLD: TIME STOP",hp:595,atk:298,chance:330000,art:"assets/cards/art/immortal-vampire.jpg",pos:"center",weatherOnly:"thunderstorm",
        fx:{timeStop:{turns:2,every:4},killHeal:{pct:25}},
        desc:"(Eksklusif cuaca THUNDERSTORM) Saat masuk dan setiap 4 giliran menghentikan waktu: kartu aktif musuh stun 2 giliran dan serangan tidak bisa dielakkan selama waktu berhenti. Setiap kill memulihkan 25% max HP."},
      {id:"CH_SEA_SOVEREIGN",name:"SEA SOVEREIGN",tier:"SR",type:"Tideborn",skill:"DIVINE TRIDENT",hp:939,atk:470,chance:700000,art:"assets/cards/art/sea-sovereign.jpg",pos:"center",weatherOnly:"thunderstorm",
        fx:{tripleHit:{hits:3,mult:0.5},flood:{every:4,mult:2,exec:20}},
        desc:"(Eksklusif cuaca THUNDERSTORM) Setiap serangan menghantam 3 kali (masing-masing 50% damage). Tiap 4 giliran melepas 40-DAY FLOOD: 2x damage dengan eksekusi pasti untuk musuh di bawah 20% HP."},
{id:"CH_PUPPETEER",name:"PUPPETEER",tier:"SR",type:"Construct",skill:"HITOKUGUTSU - HUMAN PUPPET",hp:567,atk:284,chance:280000,art:"assets/cards/art/puppeteer.jpg",pos:"center",weatherOnly:"sandstorm",
fx:{puppetPoison:{pct:10},puppetBody:{dr:20}},
desc:"(Eksklusif cuaca SANDSTORM) Tiap serangan menancapkan puppet poison: -10% ATK musuh permanen (stacking). Tubuh boneka memberi 20% pengurangan damage masuk."},
{id:"CH_SAND_VESSEL",name:"SAND VESSEL",tier:"SR",type:"Desertborn",skill:"SAND BURIAL",hp:631,atk:316,chance:350000,art:"assets/cards/art/sand-vessel.jpg",pos:"center",weatherOnly:"sandstorm",
fx:{sandBurial:{every:3,mult:2},autoBlock:{pct:25}},
desc:"(Eksklusif cuaca SANDSTORM) Tiap 3 giliran melepas SAND BURIAL: hit pasti 2x damage yang mengabaikan dodge. Di antara Sand Burial, auto-block 25% damage masuk."},
{id:"CH_BLESSED_SORCERER",name:"BLESSED SORCERER",tier:"SR",type:"Sorcerer",skill:"SIX EYES: HOLLOW PURPLE",hp:1090,atk:548,chance:850000,art:"assets/cards/art/blessed-sorcerer.jpg",pos:"center",weatherOnly:"monsoon",
fx:{autoBlock:{pct:50},flood:{every:4,mult:2,exec:0,label:"HOLLOW PURPLE"},unlimitedVoid:{below:20,turns:2,healPct:50}},
desc:"(Eksklusif cuaca MONSOON) Limitless Infinity: menerima 50% pengurangan damage dari semua sumber. Tiap serangan ke-4 melepas HOLLOW PURPLE: 2x damage yang mengabaikan semua pengurangan damage. Di bawah 20% HP: UNLIMITED VOID - stun musuh 2 giliran dan heal ke 50% (sekali per battle)."},
{id:"CH_MOON_MOTHER",name:"MOON MOTHER",tier:"SR",type:"Moonborn",skill:"AMENOMINAKA",hp:1150,atk:576,chance:1000000,art:"assets/cards/art/moon-mother.jpg",pos:"center",weatherOnly:"monsoon",
fx:{dimensionShift:{turns:2},flood:{every:4,mult:3,exec:25,label:"ALL-KILLING ASH BONES"}},
desc:"(Eksklusif cuaca MONSOON) Saat musuh masuk arena, AMENOMINAKA memindahkannya ke dimensi lain: ability aktif musuh nonaktif selama 2 giliran. Tiap serangan ke-4 melepas ALL-KILLING ASH BONES: 3x damage mengabaikan pengurangan damage, dengan eksekusi musuh di bawah 25% HP."},
  {id:"CH_ALMIGHTY_TYRANT",name:"ALMIGHTY TYRANT",tier:"SSR",type:"Tyrant",skill:"THE ALMIGHTY",hp:1210,atk:608,chance:1200000,art:"assets/cards/art/almighty-tyrant.jpg",pos:"center",weatherOnly:"aurora",
fx:{dodgeEvery:{turns:3},revive:{pct:60,lock:2}},
desc:"(Eksklusif cuaca AURORA) THE ALMIGHTY: menghindari serangan musuh di giliran ke-3. Saat tumbang, alter the future: bangkit di 60% HP dan nonaktifkan ability musuh selama 2 giliran (sekali per battle)."},
{id:"CH_DEMON_SLIME",name:"DEMON SLIME",tier:"SSR",type:"Slimeborn",skill:"PREDATOR: GLUTTONY",hp:1860,atk:933,chance:2200000,art:"assets/cards/art/demon-slime.jpg",pos:"center",weatherOnly:"aurora",
fx:{gluttony:{pct:25}},
desc:"(Eksklusif cuaca AURORA) PREDATOR: GLUTTONY: tiap membunuh, serap 25% ATK & max HP musuh secara permanen (pola snatch) dan salin ability musuh - yang terbaru menggantikan - selama kartu ini aktif di battle."},
    {id:"CH_LUCK_VOLTIA",name:"LUCK VOLTIA",tier:"R",type:"Stormcaller",skill:"LIGHTNING BATTLE FIEND",hp:169,atk:85,chance:12000,art:"assets/cards/art/luck-voltia.jpg",fx:{entryAtkPct:{pct:60},stunPunch:{every:3,chance:50,turns:1,atkPct:8,max:5}},desc:"Saat masuk arena, langsung menyerang dgn 60% ATK. Serangan ke-3 punya 50% kesempatan menstun musuh 1 giliran. Tiap stun sukses +8% ATK permanen (maks 5 stack)."},
    {id:"CH_NOBLE_COMPANION",name:"NOBLE COMPANION",tier:"R",type:"Supporter",skill:"PASSIONATE NARRATION",hp:210,atk:105,chance:25000,art:"assets/cards/art/noble-companion.jpg",fx:{partyDmg:{pct:20}},desc:"Selama Noble Companion ada di party, semua kartu party mendapat +20% damage."},
    {id:"CH_BLOODMOON_DEMON",name:"BLOODMOON DEMON",tier:"R",type:"Demon",skill:"BLOOD IGNITE",hp:222,atk:111,chance:30000,art:"assets/cards/art/bloodmoon-demon.jpg",fx:{regen:{pct:10,stopBelow:20},counterHit:{chance:40,pct:10,base:"foeMaxHp"},lowHpAtk:{below:20,bonus:100}},desc:"Regen 10% max HP tiap giliran (berhenti di bawah 20% HP). Diserang -> 40% bakar darah penyerang 10% max HP mereka. Di bawah 20% HP: mode terbangkitkan, serangan x2."},
    {id:"CH_GREEN_BEAST",name:"GREEN BEAST",tier:"SR",type:"Fighter",skill:"EIGHT GATES",hp:320,atk:160,chance:100000,art:"assets/cards/art/green-beast.jpg",fx:{eightGates:{atkPct:15,max:5,selfPct:8}},desc:"Tiap serangan kena buka 1 gerbang: +15% ATK permanen (maks 5). Gerbang penuh -> tiap mukul bayar 8% max HP sendiri."},
    {id:"CH_DRAGON_SIN",name:"DRAGON SIN",tier:"SR",type:"Holy",skill:"FULL COUNTER",hp:394,atk:197,chance:200000,art:"assets/cards/art/dragon-sin.jpg",fx:{counterHit:{chance:100,pct:30,base:"atk"}},desc:"Saat diserang, membalas 30% ATK Dragon Sin kembali ke penyerang."},
    {id:"CH_FROST_WIZARD",name:"FROST WIZARD",tier:"SR",type:"Frost",skill:"FROZEN DOUBLE",hp:436,atk:218,chance:280000,art:"assets/cards/art/frost-wizard.jpg",fx:{double:{chance:100,pct:40}},desc:"Serangan mengenai dua kali (pukulan kedua 40% damage)."},
    {id:"CH_RUBBERBOUND_CAPTAIN",name:"RUBBERBOUND CAPTAIN",tier:"SR",type:"Grappler",skill:"FIVE STAMP RUSH",hp:485,atk:243,chance:400000,art:"assets/cards/art/rubberbound-captain.jpg",fx:{double:{chance:25,pct:75}},desc:"25% kesempatan saat menyerang untuk memukul lagi dengan 75% damage."},
    {id:"CH_ICE_REAPER",name:"ICE REAPER",tier:"SR",type:"Frost",skill:"HAKKA NO TOGAME",hp:485,atk:243,chance:400000,art:"assets/cards/art/ice-reaper.jpg",fx:{deathHex:{turns:3,atkCut:30}},desc:"Saat mati, bekukan kartu musuh 3 giliran dan potong ATK mereka 30% permanen."},
    {id:"CH_FROSTBANE",name:"FROSTBANE",tier:"SR",type:"Frost",skill:"STARKFROST ICEFIELD",hp:534,atk:267,chance:550000,art:"assets/cards/art/frostbane.jpg",fx:{entryFreeze:{turns:2,mult:1.5}},desc:"Saat masuk, bekukan musuh 2 giliran. Serangan ke target beku memberikan 1.5x damage."},
    {id:"CH_COPYBLADE_MENTOR",name:"COPYBLADE MENTOR",tier:"SSR",type:"Copyist",skill:"IMPERIAL BLADE FUSION",hp:598,atk:299,chance:800000,art:"assets/cards/art/copyblade-mentor.jpg",fx:{copy:{turns:6}},desc:"Saat masuk atau musuh masuk, salin ability lawan selama 6 giliran."},
    {id:"CH_NULLBLADE_KNIGHT",name:"NULLBLADE KNIGHT",tier:"SSR",type:"Anti-Magic",skill:"NULL STANCE",hp:658,atk:329,chance:1100000,art:"assets/cards/art/nullblade-knight.jpg",fx:{dimensionShift:{turns:2},statusImmune:1,dmgMult:1.3},desc:"Saat masuk, nonaktifkan ability musuh 2 giliran. Kebal ability pengubah stat. Serangan 1.3x damage."},
    {id:"CH_TITAN_HUNTER",name:"TITAN HUNTER",tier:"SSR",type:"Warrior",skill:"BEAST KAMUI",hp:723,atk:362,chance:1500000,art:"assets/cards/art/titan-hunter.jpg",fx:{dodgeAtk:{chance:35,pct:40,max:0,nextOnly:1}},desc:"35% kesempatan menghindar serangan apapun. Tiap sukses menghindar, serangan berikutnya +40% damage."},
    {id:"CH_CRIMSON_WARLORD",name:"CRIMSON WARLORD",tier:"SSR",type:"Conqueror",skill:"METEOR SHOWER",hp:763,atk:382,chance:1800000,art:"assets/cards/art/crimson-warlord.jpg",fx:{meteorShower:{pct:15,every:4},dmgMult:1.3,dmgCut:{pct:20}},desc:"Saat masuk + tiap 4 giliran: jatuhkan meteor -> SEMUA kartu musuh rugi 15% max HP mereka (boss NPC kebal). Serangan 1.3x. Terima 20% pengurangan damage (Susano'o)."},
    {id:"CH_LIGHTBORNE_ADMIRAL",name:"LIGHTBORNE ADMIRAL",tier:"SSR",type:"Commander",skill:"YASAKANI MAGATAMA",hp:692,atk:346,chance:3000000,art:"assets/cards/art/lightborne-admiral.jpg",fx:{splash:{pct:90},dmgMult:1.5,entryCounter:{mult:0,text:"BUTA CAHAYA"}},desc:"Serangan mengenai musuh + kartu lineup berikutnya sebesar 90% damage. Serangan 1.5x. Saat masuk, butakan musuh: serangan pertama mereka meleset."},
    {id:"CH_SOUL_REAPER",name:"SOUL REAPER",tier:"SSR",type:"Wanderer",skill:"SHUKATSU",hp:890,atk:445,chance:3000000,art:"assets/cards/art/soul-reaper.jpg",fx:{revive:{pct:50,atkPct:20}},desc:"Saat mati, bangkit lagi dengan 50% HP dan +20% ATK (sekali per battle)."},
    {id:"CH_GALACTIC_TYRANT",name:"GALACTIC TYRANT",tier:"SSR",type:"Alien",skill:"DEATH BEAM",hp:1030,atk:519,chance:5000000,art:"assets/cards/art/galactic-tyrant.jpg",fx:{everyNth:{n:3,mult:1,pen:true,next:100,text:"DEATH BEAM"},lowHpAtk:{below:50,bonus:70},lowHpAura:{below:50,dr:25}},desc:"Tiap serangan ke-3 jadi Death Beam: abaikan pengurangan damage + hantam kartu lineup berikutnya. Di bawah 50% HP: evolusi Golden Galactic Tyrant, +70% ATK & 25% pengurangan damage permanen."},
    {id:"CH_SOLAR_BRAWLER",name:"SOLAR BRAWLER",tier:"SSR",type:"Saiyan",skill:"LIMIT BREAKER",hp:1090,atk:549,chance:6000000,art:"assets/cards/art/solar-brawler.jpg",fx:{statGrow:{pct:20}},desc:"Setiap giliran, semua stat naik 20% (compound). Makin lama makin mengerikan."},
    {id:"CH_TREMOR_EMPEROR",name:"TREMOR EMPEROR",tier:"UR",type:"Titan",skill:"GURA GURA GUM-GUM",hp:4780,atk:2390,chance:800000000,art:"assets/cards/art/tremor-emperor.jpg",fx:{quake:{pct:10},shockAll:{pct:15},deathStay:1},desc:"Saat masuk: gempa -> SEMUA kartu musuh rugi 10% max HP mereka. Tiap serangan shockwave 15% ATK ke seluruh lineup musuh. Fatal -> bertahan 1 giliran extra (masih menyerang)."},
    {id:"CH_ANT_KING",name:"ANT KING",tier:"UR",type:"Chimera",skill:"POST-ROSE METAMORPHOSIS",hp:5120,atk:2560,chance:1000000000,art:"assets/cards/art/ant-king.jpg",fx:{statGrow:{pct:5},gluttony:{pct:15,healPct:25,noCopy:1},revive:{pct:50,atkPct:50}},desc:"+5% stat tiap giliran. Tiap membunuh serap 15% stat musuh permanen + heal 25% max HP. Fatal -> bangkit sekali 50% HP +50% ATK."},
    {id:"CH_TIME_MASTER",name:"TIME MASTER",tier:"UR",type:"Requiem",skill:"THE WORLD",hp:7120,atk:3560,chance:3000000000,art:"assets/cards/art/time-master.jpg",fx:{dimensionShift:{turns:999},reversal:1},desc:"Saat musuh masuk, nonaktifkan ability mereka permanen. Serangan mematikan pertama dibalikkan - sisa 1 HP (sekali per battle)."},
    {id:"CH_OMNI_SOVEREIGN",name:"OMNI SOVEREIGN",tier:"UR",type:"Deity",skill:"OMNI SCALPEL",hp:8310,atk:4150,chance:5000000000,art:"assets/cards/art/omni-sovereign.jpg",fx:{eraseOnEntry:1},desc:"Saat masuk, jika total stat musuh lebih lemah dari Omni Sovereign, hapus mereka dari battle sepenuhnya."},
    {id:"CH_ASTRAL_DEVOURER",name:"ASTRAL DEVOURER",tier:"UR",type:"Cosmic",skill:"ADAPTATION + GAMMA RAY",hp:10200,atk:5120,chance:10000000000,art:"assets/cards/art/astral-devourer.jpg",fx:{statGrow:{pct:15},everyNth:{n:3,mult:4,pen:true,next:20,all:1,text:"GAMMA RAY BURST"},causality:{atkPct:15}},desc:"Adaptasi +15% stat tiap giliran. Tiap serangan ke-3: Gamma Ray Burst, 4x damage, tembus semua kartu lineup musuh 20% ATK. Fatal -> balik ke HP awal giliran sebelumnya +15% ATK (sekali)."},    /* ===== KARTU BOSS — TOKO RAID (tier BOSS, glitch hitam-putih) =====
       raidBoss:true -> terkunci di SEMUA roll sebelum dibeli, permanen sesudahnya (bossRollUnlocked).
       chance dasar 1 in 25 juta (skill: ICE BLAST + immune status effect). ===== */
{id:"CH_BALD_KING",name:"BALD KING",tier:"SSR",type:"Heroic",skill:"SERIOUS PUNCH",hp:1680,atk:843,chance:1500000,art:"assets/cards/art/bald-king.jpg",pos:"center",weatherOnly:"galactic",
fx:{seriousPunch:{charge:2,mult:5,wavePct:10,cd:3}},
desc:"(Eksklusif cuaca GALACTIC) SERIOUS PUNCH: mengisi 2 giliran tanpa menyerang, lalu giliran ke-3 melepas pukulan 5x damage + shockwave 10% ke seluruh lineup musuh. Cooldown 3 giliran."},
{id:"CH_METEOR_CONQUEROR",name:"METEOR CONQUEROR",tier:"SSR",type:"Conqueror",skill:"METEORIC BURST",hp:1280,atk:640,chance:1000000,art:"assets/cards/art/meteor-conqueror.jpg",pos:"center",weatherOnly:"galactic",
fx:{meteorWave:{pct:15},burst:{turns:3,mult:2},overheat:{delay:3,pct:10}},
desc:"(Eksklusif cuaca GALACTIC) METEORIC BURST: saat masuk meledakkan 15% max HP ke musuh + stats x2 selama 3 giliran. Setelahnya overheat: rugi 10% max HP tiap giliran."},
    {id:"CH_ETERNAL_DRAGON",name:"ETERNAL DRAGON",tier:"BOSS",type:"Raid Boss",skill:"ICE BLAST",hp:5200,atk:2600,chance:25000000,art:"assets/raid/eternal-dragon-hd.png",pos:"center",raidBoss:true,
      fx:{statusImmune:true,iceBlast:{chance:50,pct:75,hits:3}},
      desc:"TIDAK PERNAH terkena status effect apapun (stun, burn, dan efek negatif lainnya). 50% peluang menembakkan ICE BLAST: 3 serangan beruntun masing-masing 75% ATK."}
  ]
};
/* ROLL SYSTEM - Pull-based RNG (bukan gacha pool) */
const RNG_ROLL_SPEED=1500; // ms per roll (base)
const RNG_ROLL_MIN=300;    // ms minimum per roll — speed cap, kartu harus sempat keliatan
const RNG_ROLL_MAX_MULT=RNG_ROLL_SPEED/RNG_ROLL_MIN; // ≈ 5×
const RNG_TOTAL_WEIGHT=1000000; // total weight untuk probability

/* ===== WEATHER SYSTEM (15 cuaca, ikut tier RARE / UNCOMMON / COMMON) =====
   dropWeight = bobot per 10.000 roll (total 10.000). Semua chance yang tampil
   di panel WEATHER ODDS dihitung langsung dari bobot ini (pct = w/100,
   "1 in X" = 10000/w).
   Cuaca alami: siklus 30 menit, weighted penuh, TANPA pity (boleh turun kelas).
   Weather Potion = GACHA: roll weighted penuh. Hasil sama/lebih bagus (dropWeight
   <= cuaca aktif) -> pindah + timer reset 5 menit; lebih jelek -> cuaca TETEP
   (potion tetep kepotong). PITY berlaku di roll POTION aja:
   100 roll potion tanpa RARE -> dijamin kelas RARE (GOOFY..ECLIPSE),
   250 tanpa AWAKENED -> dijamin AWAKENED (counter `state.wpity`,
   bareng Mythic Potion). ARCANE gak reset counter apa pun.
   Mythic Weather Potion = sama, tapi AWAKENED di-override jadi 3%.
   weatherBest = stat "cuaca terbaik pernah" (display), ke-update dari SEMUA roll.
   Pas aktif: totalLuck x luckBonus, roll speed x speedBonus, pool nambah kartu
   weatherOnly yang cocok. */
const WEATHER_MS=300000; // 5 menit (durasi window potion)
const WEATHER_ROTATE_MS=1800000; // 30 menit (siklus alami tiap cuaca)
const WEATHERS=[
  /* RARE (paling langka -> paling kuat) */
  {id:"awakened",   name:"AWAKENED",   icon:"👁",  dropWeight:1,   rar:"AWAKENED", luckBonus:15.0, speedBonus:8.0, color:"#c084fc"},
  {id:"arcane",     name:"ARCANE",     icon:"🔮",  dropWeight:5,   rar:"ARCANE",   luckBonus:10.0, speedBonus:6.0, color:"#a78bfa"},
  {id:"goofy",      name:"GOOFY",      icon:"🤪",  dropWeight:15,  rar:"RARE",     luckBonus:7.0,  speedBonus:4.5, color:"#fde047"},
  {id:"glitch",     name:"GLITCH",     icon:"📺",  dropWeight:20,  rar:"RARE",     luckBonus:6.0,  speedBonus:4.0, color:"#f87171"},
  {id:"doodle",     name:"DOODLE",     icon:"🎨",  dropWeight:25,  rar:"RARE",     luckBonus:5.0,  speedBonus:3.5, color:"#f1f5f9"},
  {id:"eclipse",    name:"ECLIPSE",    icon:"🌑",  dropWeight:40,  rar:"RARE",     luckBonus:4.0,  speedBonus:3.0, color:"#c4b5fd"},
  /* UNCOMMON */
  {id:"iceage",     name:"ICE AGE",    icon:"🧊",  dropWeight:67,  rar:"UNCOMMON", luckBonus:3.5,  speedBonus:3.0, color:"#67e8f9"},
  {id:"galactic",   name:"GALACTIC",   icon:"🪐",  dropWeight:100, rar:"UNCOMMON", luckBonus:3.0,  speedBonus:2.5, color:"#fb923c"},
  {id:"aurora",     name:"AURORA",     icon:"🌌",  dropWeight:143, rar:"UNCOMMON", luckBonus:2.5,  speedBonus:2.0, color:"#5eead4"},
  {id:"monsoon",    name:"MONSOON",    icon:"🌊",  dropWeight:333, rar:"UNCOMMON", luckBonus:2.0,  speedBonus:1.8, color:"#60a5fa"},
  /* COMMON */
  {id:"sandstorm",  name:"SANDSTORM",  icon:"🌪",  dropWeight:1000,rar:"COMMON",   luckBonus:1.3,  speedBonus:1.4, color:"#fbbf24"},
  {id:"thunderstorm",name:"THUNDERSTORM",icon:"⛈", dropWeight:1000,rar:"COMMON",   luckBonus:1.4,  speedBonus:1.5, color:"#fde047"},
  {id:"snowfall",   name:"SNOWFALL",   icon:"❄",  dropWeight:1400,rar:"COMMON",   luckBonus:1.25, speedBonus:1.3, color:"#bae6fd"},
  {id:"lightrain",  name:"LIGHT RAIN", icon:"🌦",  dropWeight:2340,rar:"COMMON",   luckBonus:1.2,  speedBonus:1.2, color:"#7dd3fc"},
  {id:"windy",      name:"WINDY",      icon:"🍃",  dropWeight:3511,rar:"COMMON",   luckBonus:1.1,  speedBonus:1.1, color:"#86efac"},
];
const WEATHER=Object.fromEntries(WEATHERS.map(w=>[w.id,w]));
/* Rank 0..N berdasar dropWeight ASC (paling langka = rank 0 = paling BAGUS). Dipakai buat stat weatherBest (cuaca terbaik pernah) + banding hasil gacha potion (rank hasil <= rank aktif = pindah + reset timer; lebih = cuaca tetep). */
function weatherRank(id){const s=[...WEATHERS].sort((a,b)=>a.dropWeight-b.dropWeight);return s.findIndex(w=>w.id===id);}
function betterWeather(a,b){if(!a)return b;if(!b)return a;return weatherRank(a)<=weatherRank(b)?a:b;}
/* Weather yang SEKARANG aktif (null kalau belum/gampang window 5 menit udah lewat). Auto-clear saat kedaluwarsa. */
function activeWeatherId(){if(!state||!state.weather)return null;if(Date.now()>=state.weather.endsAt){state.weather=null;return null;}return state.weather.id;}
function weatherLuckMult(){const id=activeWeatherId();return id?WEATHER[id].luckBonus:1;}
function weatherSpeedMult(){const id=activeWeatherId();return id?WEATHER[id].speedBonus:1;}
/* ====== SKILL TREE: 1 SP tiap naik LV. SATU pohon, DUA cabang (LUCK & SPEED).
   Node nyambung dari ROOT -> bisa ngocor satu cabang atau bagi dua; SP = tradeoff.
   luck nambah luckFlat, speed nambah pengali roll-speed permanen (tetep kena cap 5x). ====== */
const TREE_NODES=[
  {id:"root",  branch:"root", tier:0,name:"FONDASI",       cost:0,luck:0,   speed:0,  req:[],                      desc:"Titik awal pohon skill."},
  {id:"lk1",   branch:"luck", tier:1,name:"PEKA",          cost:1,luck:5,   speed:0,  req:["root"],                desc:"Mata mulai tajam cari yang langka."},
  {id:"lk2",   branch:"luck", tier:2,name:"TERLIHAT",      cost:3,luck:10,  speed:0,  req:["lk1"],                 desc:"Peluang kartu bagus naik."},
  {id:"lk3",   branch:"luck", tier:3,name:"MENTARI",       cost:5,luck:15,  speed:0,  req:["lk2"],                 desc:"Rezeki mulai ngalir."},
  {id:"lk4",   branch:"luck", tier:4,name:"BERTUAH",       cost:10,luck:20, speed:0,  req:["lk3"],                 desc:"Tuaian hoki melimpah."},
  {id:"lk5",   branch:"luck", tier:5,name:"MUARA REZEKI",  cost:15,luck:25, luckPct:0.1, speed:0, req:["lk4"],      desc:"Semua aliran hoki bermuara ke lo. +10% pengali luck."},
  {id:"sp1",   branch:"speed",tier:1,name:"RINGAN",        cost:1,luck:0,   speed:0.4,req:["root"],                desc:"Roll mulai ngebut."},
  {id:"sp2",   branch:"speed",tier:2,name:"CEPAT",         cost:3,luck:0,   speed:0.6,req:["sp1"],                 desc:"Jeda antar-roll mengecil."},
  {id:"sp3",   branch:"speed",tier:3,name:"PETIR",         cost:5,luck:0,   speed:0.8,req:["sp2"],                 desc:"Sambaran roll super cepat."},
  {id:"sp4",   branch:"speed",tier:4,name:"KILAT",         cost:10,luck:0,  speed:1.0,req:["sp3"],                 desc:"Nyaris gak kerasa nunggu."},
  {id:"sp5",   branch:"speed",tier:5,name:"CAHAYA",        cost:15,luck:0,  speed:1.2,req:["sp4"],                desc:"Mentok speed cap 5x (kumulatif 5.0x)."},
];
const TREE=Object.fromEntries(TREE_NODES.map(n=>[n.id,n]));
function treeOwned(id){return !!(state&&state.player&&state.player.tree&&state.player.tree[id]);}
function treeLuckFlat(){let s=0;for(const n of TREE_NODES){if(treeOwned(n.id))s+=(n.luck||0);}return s;}
function treeLuckPct(){let s=0;for(const n of TREE_NODES){if(treeOwned(n.id))s+=(n.luckPct||0);}return s;}
function playerSpeedMult(){let s=1;for(const n of TREE_NODES){if(treeOwned(n.id))s+=(n.speed||0);}s+=activeSpeedBuff();return Math.min(5,s);}
function treeBuy(id){
  const n=TREE[id];if(!n||id==="root")return{ok:false,reason:"NODE"};
  if(!state||!state.player)return{ok:false,reason:"NOSTATE"};
  const p=state.player;p.tree=p.tree||{};
  if(p.tree[id])return{ok:false,reason:"OWNED"};
  if(!n.req.every(r=>r==="root"||p.tree[r]))return{ok:false,reason:"PREQ"};
  if((p.sp||0)<n.cost)return{ok:false,reason:"SP"};
  p.sp-=n.cost;p.tree[id]=true;save();return{ok:true,node:n};
}
/* Weighted pick dari daftar weather (pakai dropWeight). */
function weatherPick(ws){
  let tot=0;ws.forEach(w=>tot+=w.dropWeight);
  let r=Math.random()*tot,pick=ws[ws.length-1];
  for(let i=0;i<ws.length;i++){r-=ws[i].dropWeight;if(r<=0){pick=ws[i];break;}}
  return pick;
}
/* Roll 1 weather: weighted penuh ikut dropWeight asli (boleh turun kelas).
   opts.boostAwakened=true -> AWAKENED di-override jadi 3% flat (untuk mythic). */
function rollWeather(opts){
  opts=opts||{};
  let eligible=WEATHERS;
  if(opts.boostAwakened&&eligible.some(w=>w.id==="awakened")){
    if(Math.random()<0.03)return WEATHER.awakened;
    const rest=eligible.filter(w=>w.id!=="awakened");
    if(rest.length)eligible=rest;
  }
  return weatherPick(eligible);
}
/* Gacha potion: roll full weighted. Hasil sama/lebih bagus (dropWeight <=
   cuaca aktif; tie berat = setara -> pindah) -> pindah + timer reset 5 menit.
   Hasil lebih jelek -> cuaca tetep, timer gak disentuh (potion tetep kepotong;
   return kept:true). */
function applyPotionRoll(w){
  const cur=activeWeatherId();
  if(cur&&w.dropWeight>WEATHER[cur].dropWeight)return {kept:true,weather:WEATHER[cur]};
  state.weatherBest=betterWeather(state.weatherBest,w.id);
  state.weather={id:w.id,endsAt:Date.now()+WEATHER_MS};
  return {kept:false,weather:w};
}
/* ===== PITY POTION — counter pemakaian Weather + Mythic Potion (ke-save).
   p.r >= PITY_RARE   -> roll potion berikutnya DIJAMIN kelas RARE.
   p.m >= PITY_MYTHIC -> roll potion berikutnya DIJAMIN AWAKENED.
   Reset: hasil RARE set r=0, hasil AWAKENED set m=0. Siklus alami 30 menit
   gak ngitung counter ini (pity = fitur gacha potion doang). ===== */
const PITY_RARE=100, PITY_MYTHIC=250;
function potionWeatherRoll(opts){
  opts=opts||{};
  if(!state.wpity||typeof state.wpity.r!=="number"||typeof state.wpity.m!=="number")state.wpity={r:0,m:0};
  const p=state.wpity;
  let w;
  if(p.m>=PITY_MYTHIC)w=WEATHER.awakened;
  else if(p.r>=PITY_RARE)w=weatherPick(WEATHERS.filter(x=>x.rar==="RARE"));
  else w=rollWeather(opts);
  p.r++;p.m++;
  if(w.rar==="RARE")p.r=0;
  if(w.id==="awakened")p.m=0;
  return w;
}
function useWeatherPotion(){
  if(!state||!state.potions||state.potions<1)return {ok:false,reason:"NO_POTION"};
  state.potions--;
  const r=applyPotionRoll(potionWeatherRoll());
  save();
  return {ok:true,kept:r.kept,weather:r.weather};
}
/* Mythic Weather Potion: aturan gacha sama, tapi AWAKENED chance 3%. */
function useMythicWeatherPotion(){
  if(!state||(state.mythicPotions||0)<1)return {ok:false,reason:"NO_POTION"};
  state.mythicPotions--;
  const r=applyPotionRoll(potionWeatherRoll({boostAwakened:true}));
  save();
  return {ok:true,kept:r.kept,weather:r.weather};
}
const WEATHER_POTION_PRICE=5000;
/* ====== POTION LUCK & SPEED (L1-L3 · Toko Inf + Toko Raid). Buff sementara 5 menit per pot.
   PER-LEVEL: state.luckBuffs/state.speedBuffs = array entry [{lv,flat/pct/add,endsAt}] — satu entry
   per level, GAK digabung. Stack se-level: luck/speed di-CAP 1x dasar per level (GAK nambah walau pakai lagi);
   beda level jalan timer-nya masing-masing. Baca via luckBuffs()/speedBuffs(). ====== */
const POTION_BUFF_MS=5*60*1000;
const LUCK_POTS=[null,{flat:3,pct:0},{flat:5,pct:0.10},{flat:10,pct:0.20}];
const SPEED_POTS=[null,{add:0.2},{add:0.5},{add:1.0}];
function activeLuckBuff(){return luckBuffs().reduce((s,b)=>s+(b.flat||0),0);}
function activeLuckBuffPct(){return luckBuffs().reduce((s,b)=>s+(b.pct||0),0);}
function activeSpeedBuff(){return speedBuffs().reduce((s,b)=>s+(b.add||0),0);}
function luckBuffs(){if(!state||!Array.isArray(state.luckBuffs))return[];const now=Date.now();state.luckBuffs=state.luckBuffs.filter(b=>b&&b.endsAt>now);return state.luckBuffs;}
function speedBuffs(){if(!state||!Array.isArray(state.speedBuffs))return[];const now=Date.now();state.speedBuffs=state.speedBuffs.filter(b=>b&&b.endsAt>now);return state.speedBuffs;}
function useLuckPotion(lv,n){
  lv=Math.max(1,Math.min(3,lv|0));n=Math.max(1,n|0);
  const def=LUCK_POTS[lv];
  if(!state||!def||(state.luckPots[lv-1]||0)<n)return{ok:false,reason:"NO_POTION"};
  state.luckPots[lv-1]-=n;
  const now=Date.now();
  if(!Array.isArray(state.luckBuffs))state.luckBuffs=[];
  let e=state.luckBuffs.find(x=>x.lv===lv);
  if(!e){e={lv:lv,flat:0,pct:0,endsAt:now};state.luckBuffs.push(e);}
  else if(e.endsAt<=now){e.flat=0;e.pct=0;e.endsAt=now;}
  e.flat=(e.flat||0)+def.flat*n;
  e.pct=(e.pct||0)+def.pct*n;
  e.endsAt+=POTION_BUFF_MS*n;
  save();
  return{ok:true,flat:e.flat,pct:e.pct,ms:POTION_BUFF_MS*n};
}
function useSpeedPotion(lv,n){
  lv=Math.max(1,Math.min(3,lv|0));n=Math.max(1,n|0);
  const def=SPEED_POTS[lv];
  if(!state||!def||(state.speedPots[lv-1]||0)<n)return{ok:false,reason:"NO_POTION"};
  state.speedPots[lv-1]-=n;
  const now=Date.now();
  if(!Array.isArray(state.speedBuffs))state.speedBuffs=[];
  let e=state.speedBuffs.find(x=>x.lv===lv);
  if(!e){e={lv:lv,add:0,endsAt:now};state.speedBuffs.push(e);}
  else if(e.endsAt<=now){e.add=0;e.endsAt=now;}
  e.add=(e.add||0)+def.add*n;
  e.endsAt+=POTION_BUFF_MS*n;
  save();
  return{ok:true,add:e.add,ms:POTION_BUFF_MS*n};
}
/* Panel weather GABUNGAN (pojok kiri bawah): nama + "Ends in Xs" di atas, baris kartu
   weatherOnly (gaya index, hover reveal penuh) di tengah, buff luck/rollspeed di bawah.
   Nongol cuma pas weather aktif. Dipanggil tiap renderShell & tick detik. */
function renderWeatherDock(){
  const panel=document.getElementById("weatherPanel");if(!panel)return;
  const id=activeWeatherId();const w=id?WEATHER[id]:null;
  /* Kartu weatherOnly milik cuaca yang LAGI AKTIF — cuaca tanpa kartu tetep
     tampil (nama + timer + buff), baris kartu dikosongkan. */
  const cards=MASTER_CARD_INDEX.filter(c=>c.weatherOnly===id);
  if(!w){panel.classList.remove("show");panel.innerHTML="";return;}
  panel.style.setProperty("--wc",w.color);
  panel.innerHTML=`<div class="wp-head"><span class="wp-name"><span class="wp-ic">${w.icon}</span>${w.name}</span><span class="wp-timer">Ends in ${fmtCountdown(state.weather.endsAt-Date.now())}</span></div>`
    +(cards.length?`<div class="wp-cards">`+cards.map(c=>
      `<div class="wc-slot active" data-wc="${c.char_id}" style="--wc:${w.color}">
        <span class="idx-art"><img src="${c.sprite_asset}" alt=""></span>
        <span class="idx-body"><span class="wc-chance">${rarityText(c.tier,luckChance(c.char_id))}</span></span>
      </div>`).join("")+`</div>`:"")
    +`<div class="wp-buff">${w.luckBonus}x Luck · ${w.speedBonus}x Rollspeed</div>`;
  panel.classList.add("show");
  wcHoverBind();
}
/* ====== BUFF DOCK (pojok kanan bawah): luck & speed potion AKTIF — SATU CHIP PER LEVEL
   (L1/L2/L3 gak digabung), icon sesuai level + efek level itu + timer live masing-masing.
   Nongol cuma pas ada buff; dipanggil tiap renderShell & tick detik. ====== */
/* ====== BUFF DOCK (pojok kanan bawah) — gaya referensi user: slot gelap rounded,
   border warna per tipe, ikon di tengah, badge angka (sisa detik timer / ✓) nempel
   di tepi ATAS slot. Isi: potion yang lagi AKTIF doang (luck/speed L1-L3 per level,
   timer live masing-masing) + artefak yang lagi di-equip. Nongol cuma pas ada isinya;
   dipanggil tiap renderShell & tick detik. ====== */
function renderBuffDock(){
  const el=document.getElementById("buffDock");if(!el)return;
  const now=Date.now();
  const ls=luckBuffs().slice().sort((a,b)=>a.lv-b.lv);
  const ss=speedBuffs().slice().sort((a,b)=>a.lv-b.lv);
  const arts=(state&&state.artSlots||[]).map(id=>ART_DEFS.find(d=>d.id===id)).filter(Boolean);
  if(!ls.length&&!ss.length&&!arts.length){el.classList.remove("show");el.innerHTML="";return;}
  /* Slot chip: badge timer countdown di atas + ikon tengah. emoji = fallback kalau img gagal.
     Tooltip hover (bukan title native): main = nama, sub = deskripsi passive + sisa waktu. */
  const chip=(cls,src,emoji,main,sub,ms)=>`<div class="bd-chip ${cls}">
      <span class="bd-badge">${fmtCountdown(ms)}</span>
      <span class="bd-ic"><img src="${src}" alt="" onerror="this.parentNode.textContent='${emoji}'"></span>
      <span class="bd-tip"><b>${main}</b><small>${sub}</small></span>
    </div>`;
  let html="";
  ls.forEach(b=>{
    const lTxt=b.lv>0?"L"+b.lv+" ":"";
    const p=b.pct||0;
    html+=chip("luck","assets/images/pot-luck-"+b.lv+".png","🍀",
      `LUCK ${lTxt}POTION`.trim(),
      `+${b.flat||0} FLAT${p>0?` · +${Math.round(p*100)}%`:""} LUCK · sisa ${fmtCountdown(b.endsAt-now)}`,b.endsAt-now);
  });
  ss.forEach(b=>{
    const lTxt=b.lv>0?"L"+b.lv+" ":"";
    html+=chip("speed","assets/images/pot-speed-"+b.lv+".png","⚡",
      `SPEED ${lTxt}POTION`.trim(),
      `+${(b.add||0).toFixed(1)}× SPEED · sisa ${fmtCountdown(b.endsAt-now)}`,b.endsAt-now);
  });
  arts.forEach(d=>{
    const icon=d.img?`<img src="${d.img}" alt="" onerror="this.remove()">`:"💎";
    html+=`<div class="bd-chip art" style="--sc:${d.color}">
      <span class="bd-badge eq">&#10003;</span>
      <span class="bd-ic">${icon}</span>
      <span class="bd-tip"><b>${d.name}</b><small>${luckTxt(d)} · TERPASANG</small></span>
    </div>`;
  });
  el.innerHTML=html;
  el.classList.add("show");
}
function toast(main,sub,color){
  const t=document.getElementById("weatherToast");if(!t)return;
  t.style.setProperty("--wdc",color||"#38b7ff");
  t.innerHTML=`${main}${sub?`<small>${sub}</small>`:""}`;
  t.classList.add("show");
  if(toast._tm)clearTimeout(toast._tm);
  toast._tm=setTimeout(()=>t.classList.remove("show"),2200);
}
let weatherTickStarted=false;
function startWeatherTick(){
  if(weatherTickStarted)return;weatherTickStarted=true;
  /* ensureWeather: window habis / save lama tanpa weather -> roll cuaca ALAMI berikutnya
     (weighted, tanpa pity - bebas turun kelas), 30 menit. weatherBest tetep ke-update
     biar stat "cuaca terbaik pernah" akurat. silent=true buat seeding pas boot (tanpa toast). */
  const ensureWeather=silent=>{
    if(!state)return null;
    if(state.weather&&Date.now()<state.weather.endsAt)return null;
    const w=rollWeather();
    state.weatherBest=betterWeather(state.weatherBest,w.id);
    state.weather={id:w.id,endsAt:Date.now()+WEATHER_ROTATE_MS};
    save();
    if(!silent){toast(`${w.icon} ${w.name}`,"CUACA BERUBAH · 30 MENIT",w.color);beep(520,.14,"sine",.06);setTimeout(()=>beep(700,.16,"sine",.06),130);}
    return w;
  };
  window.ensureWeather=ensureWeather;
  ensureWeather(true);           /* seed cuaca pertama pas boot (tanpa toast) */
  renderShell();                 /* refresh UI dgn weather sudah ada */
  setInterval(()=>{
    if(!state)return;
    const hadActive=!!state.weather&&Date.now()<state.weather.endsAt;
    const changed=ensureWeather(false);   /* auto-rotate: habis -> roll baru + toast */
    renderWeatherDock();renderBuffDock();
    if(changed||(!hadActive&&state.weather))renderShell(); /* refresh chip/speed pas cuaca ganti */
    /* live refresh modal profil pas terbuka (countdown cuaca/potion) */
    try{const pm=document.getElementById("profModal");if(pm&&pm.style.display==="flex")renderProfile();}catch(e){}
  },1000);
}

// Drop rates: R=common, SR=uncommon, SSR=rare, UR=epic, EX=legendary, noGacha=exclusive
// Format: {tier: string, baseWeight: number}
const RNG_DROP_RATES=[
  {tier:"R",      name:"Common",     baseWeight:500000},  // 50% chance
  {tier:"SR",     name:"Uncommon",   baseWeight:250000},  // 25% chance
  {tier:"SSR",    name:"Rare",       baseWeight:180000},  // 18% chance
  {tier:"UR",     name:"Epic",       baseWeight:45000},   // 4.5% chance
  {tier:"EX",     name:"Legendary",  baseWeight:24500}    // 2.45% chance
];

// Main RNG roll function. luckMultiplier = totalLuck() = (base+flat)*(1+percent).
// SISTEM ASLI: bobot per varian = 1 / max(statMult, ch/L) — peluang beneran "1 in (chance dibagi luck)".
// Luck = pengali chance LINEAR: kartu "1 in 40.000.000" dengan luck 1000 → efektif ≈ 1 in 40.000.
// Floor = statMult (mut×shiny): L cuma nge-skala kartu DASAR; mutasi/shiny tetap pembagi kelangkaan
//   relatif presisi (gold = 5x lebih langka dari base-nya) di luck berapa pun — gak pernah ke-flatten.
// Di L=1 bobot = 1/max(statMult, ch) (mutasi awal susah, identik desain lama). ch/L<statMult → bobot penuh.
// Display "1 in X" memakai base MENTAH (ch, tanpa pembagian luck) lewat luckChance() — biar kesan rarity-nya "wah".
function rngRoll(luckMultiplier=1,speedMultiplier=1){
  const L=(typeof luckMultiplier==="number"&&luckMultiplier>0)?luckMultiplier:1;
  const aw=activeWeatherId();
  const pool=gachaPool();
  if(!pool.length)return null;
  const MUTS=["none","gold","rainbow","secret"];
  const entries=[];
  for(const c of pool){
    const base=c.chance||chanceOf(c.tier);
    for(const shiny of [false,true]){
      for(const mut of MUTS){
        const statMult=(shiny?SHINY_MULT:1)*(MUT_MULT[mut]||1);
        entries.push({card:c,mut,shiny,ch:base*statMult,m:statMult});
      }
    }
  }
  let total=0;
  const weights=entries.map(e=>{const w=1/Math.max(e.m,e.ch/L);total+=w;return w;});
  let r=Math.random()*total, idx=entries.length-1;
  for(let i=0;i<entries.length;i++){r-=weights[i];if(r<=0){idx=i;break;}}
  const pick=entries[idx];
  return{
    cardId:pick.card.char_id,
    tier:pick.card.tier,
    mut:pick.mut,
    shiny:pick.shiny,
    chance:pick.ch,                                    // base raw chance
    effChance:Math.ceil(pick.ch/L),                    // flat display = ch / totalLuck
    speedBoost:speedMultiplier
  };
}

/* ========== BACKPACK + ROLL SYSTEM ========== */
let rollState = { active: false, interval: null, currentCard: null, luck: 1, speedMultiplier: 1, mini: false, collapsed: false, hideTimer: null, fadeTimer: null };
let __batchRoll = false;

/* Roll = SATU-SATUNYA sumber kartu baru selain Toko Raid. Hasil roll DITUMPUK dengan sistem count:
   kartu yang sama (char + tier + varian/mut) masuk ke satu stack dan menaikkan s.count, bukan entri baru,
   biar backpack tidak membengkak. Tiap varian (SHINY/GOLD/RAINBOW/SECRET) numpuk jadi pile sendiri. */
function grantRolledCard(charId, mut, shiny) {
  const card = CARDS[charId];
  if (!card || !state) return null;
  if (!Array.isArray(state.stacks)) state.stacks = [];
  const m = mut || "none";
  const sh = !!shiny;
  const s = state.stacks.find(x => x.char === charId && x.tier === card.tier && (x.mut || "none") === m && !!x.shiny === sh);
  if (s) {
    s.count = (s.count || 1) + 1;
    if(!__batchRoll){save();rollCountBadge();idxRewardSync();}
    return s;
  }
  const ns = { id: Math.random().toString(36).slice(2, 9), char: charId, tier: card.tier, fav: false, lock: false, mut: m, shiny: sh, trait: "none", count: 1 };
  state.stacks.push(ns);
  if (!Array.isArray(state.deck)) state.deck = [null, null, null, null];
  state.deck.length = 4;
  const empty = state.deck.indexOf(null);
  if (empty >= 0) setDeckSlot(empty, ns.id); else if(!__batchRoll)save();
  if(!__batchRoll){rollCountBadge();idxRewardSync();}
  return ns;
}
/* Instant roll massal (dipakai reward Infinite Tower): n roll sekaligus, simpan sekali di akhir. */
function instantRoll(n){
  __batchRoll=true;
  const res=[];
  try{ for(let i=0;i<n;i++){ const r=rngRoll(totalLuck()); if(!r)continue; grantRolledCard(r.cardId,r.mut,r.shiny); res.push(r);} }
  finally{ __batchRoll=false; }
  save(); rollCountBadge(); return res;
}

/* ===== INDEX REWARD: INTAN ROLL 100K =====
   Progress = jumlah varian unik yang dimiliki (char x mutasi x shiny; 8 varian per kartu,
   mencakup semua mutasi + kombinasi shiny / "double mutasi"). Tiap 5 varian terkumpul =
   +1 item INTAN ROLL 100K otomatis masuk tab ITEM backpack. Pakai item = menarik
   100.000 roll kartu sekaligus. Klaim idempoten lewat state.idxRewardsClaimed. */
const IDX_MILESTONE=5;
function idxVariantKey(s){return s.char+"|"+(s.mut||"none")+"|"+(s.shiny?1:0);}
function idxProgress(){
  const owned=new Set((state&&state.stacks||[]).map(idxVariantKey));
  const total=(typeof MASTER_CARD_INDEX!=="undefined"?MASTER_CARD_INDEX.length:0)*8;
  const count=owned.size;
  return {owned:owned,count:count,total:total,blocks:Math.floor(count/IDX_MILESTONE),claimed:(state&&state.idxRewardsClaimed)||0};
}
function idxRewardSync(silent){
  if(!state)return 0;
  const P=idxProgress();
  const gain=P.blocks-P.claimed;
  if(gain<=0)return 0;
  state.idxRewardsClaimed=P.blocks;
  state.intanRolls=(state.intanRolls||0)+gain;
  save();
  if(!silent){
    beep(640,.16,"triangle",.09);setTimeout(()=>beep(920,.2,"triangle",.08),120);
    toast("INDEX REWARD!","+"+gain+" INTAN ROLL 100K · CEK BACKPACK","#7DF9FF");
  }
  return gain;
}
/* Versi cepat instantRoll untuk jumlah besar: bobot tiap varian dibangun SEKALI,
   pemilihan lewat binary search prefix (bukan rngRoll berulang) — 100k roll dalam hitungan detik. */
function instantRollFast(n){
  if(!(n>0))return [];
  const L=(typeof totalLuck==="function"&&totalLuck()>0)?totalLuck():1;
  const aw=activeWeatherId();
  const pool=gachaPool();
  const MUTS=["none","gold","rainbow","secret"];
  const entries=[];const cum=[];let total=0;
  for(const c of pool){
    const base=c.chance||chanceOf(c.tier);
    for(const shiny of [false,true])for(const mut of MUTS){
      const statMult=(shiny?SHINY_MULT:1)*(MUT_MULT[mut]||1);
      const ch=base*statMult;
      total+=1/Math.max(statMult,ch/L);
      entries.push({card:c,mut:mut,shiny:shiny,ch:ch});
      cum.push(total);
    }
  }
  if(!entries.length)return [];
  const pick=()=>{const r=Math.random()*total;let lo=0,hi=entries.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(cum[mid]<r)lo=mid+1;else hi=mid;}
    return entries[lo];};
  __batchRoll=true;
  const res=[];
  try{
    for(let i=0;i<n;i++){
      const e=pick();
      grantRolledCard(e.card.char_id,e.mut,e.shiny);
      res.push({cardId:e.card.char_id,tier:e.card.tier,mut:e.mut,shiny:e.shiny,chance:e.ch});
    }
  } finally{ __batchRoll=false; }
  save(); rollCountBadge(); idxRewardSync(true);
  return res;
}

function rollCountBadge() {
  const toggle = document.getElementById('backpackToggle');
  if (toggle && state) {
    const count = state.stacks.length;
    toggle.setAttribute('data-count', count);
    toggle.classList.toggle('has-items', count > 0);
  }
}

function startRollAnimation(luck, speedMultiplier = 1) {
  if (rollState.active) return;

  // Jika luck tidak diberikan, pakai totalLuck() dari state (base+flat)*(1+percent).
  const appliedLuck = (typeof luck === "number" && luck > 0) ? luck : totalLuck();
  rollState.luck = appliedLuck;
  // Clamp speed multiplier → jangan pernah di bawah RNG_ROLL_MIN (300ms). Speed pohon + cuaca, cap 5x.
  rollState.speedMultiplier = Math.max(1, Math.min(speedMultiplier*playerSpeedMult()*weatherSpeedMult(), RNG_ROLL_MAX_MULT));
  rollState.active = true;

  const rollBtn = document.getElementById('rollBtn');
  if (rollBtn) rollBtn.classList.add('active');
  const ra = document.getElementById('rollAutoBtn');
  if (ra) ra.classList.add('on');
  if (rollState.hideTimer) { clearTimeout(rollState.hideTimer); rollState.hideTimer = null; }

  // Set initial delay based on speed multiplier
  const initialDelay = Math.max(RNG_ROLL_MIN, RNG_ROLL_SPEED / rollState.speedMultiplier);
  
  rollState.interval = setInterval(() => {
    const result = rngRoll(rollState.luck, rollState.speedMultiplier);
    if(!result){stopRollAnimation();hideRollResult();return;}
    // Tambah EXP (50/roll), simpan di state.player.exp
    if(state&&state.player){
      state.player.exp=(state.player.exp||0)+50;
    }
    showRollResult(result);
    renderShell(); // Update XP bar & level check
    grantRolledCard(result.cardId, result.mut, result.shiny);
  }, initialDelay);
}

function stopRollAnimation() {
  rollState.active = false;
  if (rollState.interval) {
    clearInterval(rollState.interval);
    rollState.interval = null;
  }
  if (rollState.hideTimer) {
    clearTimeout(rollState.hideTimer);
    rollState.hideTimer = null;
  }
  const rollBtn = document.getElementById('rollBtn');
  if (rollBtn) rollBtn.classList.remove('active');
  const ra = document.getElementById('rollAutoBtn');
  if (ra) ra.classList.remove('on');
}

function rvFx(card, overlay, tcol) {
  try {
    if (!tcol) tcol = '#7DF9FF';
    const r = card.getBoundingClientRect();
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('i'); p.className = 'rv-part';
      const cx = r.left + (i % 2 ? r.width : 0), cy = r.top + Math.random() * r.height;
      p.style.left = cx + 'px'; p.style.top = cy + 'px';
      const ang = Math.atan2(cy - (r.top + r.height / 2), cx - (r.left + r.width / 2)) + (Math.random() - .5);
      const dist = 90 + Math.random() * 140;
      p.style.setProperty('--ox', Math.cos(ang) * dist + 'px');
      p.style.setProperty('--oy', Math.sin(ang) * dist + 'px');
      p.style.background = tcol; p.style.filter = 'drop-shadow(0 0 6px ' + tcol + ')';
      p.style.animationDelay = (i * 0.04) + 's';
      overlay.appendChild(p); setTimeout(() => p.remove(), 2600);
    }
    for (let i = 0; i < 20; i++) {
      const d = document.createElement('i'); d.className = 'rv-dust';
      d.style.left = (r.left + Math.random() * r.width) + 'px';
      d.style.top = (r.top + r.height * (0.4 + Math.random() * 0.55)) + 'px';
      const s = 3 + Math.random() * 6; d.style.width = d.style.height = s + 'px';
      d.style.setProperty('--dx', ((Math.random() - .5) * 160) + 'px');
      d.style.setProperty('--dy', (-(120 + Math.random() * 160)) + 'px');
      d.style.animationDelay = (i * 0.06) + 's';
      overlay.appendChild(d); setTimeout(() => d.remove(), 3200);
    }
  } catch (e) {}
}

function showRollResult(result) {
  const overlay = document.getElementById('rollOverlay');
  if (!overlay) return;
  const showcase = overlay.querySelector('.roll-card-showcase');
  if (!showcase) return;
  /* fix race: batalkan fade-out pending - timeout lama jangan nutup reveal baru */
  if (rollState.fadeTimer) { clearTimeout(rollState.fadeTimer); rollState.fadeTimer = null; }
  showcase.style.opacity=''; showcase.style.transform=''; showcase.style.transition='';
  const cardData = getCardData(result.cardId);
  if (!cardData) return;
  rollState.currentCard = result;
  // Jangan paksa buka: kalau user lagi hide (collapsed), biarin tetep kesembunyi
  // (mis. pas AUTO farming). Isi kartu tetap ke-update di atas, jadi pas di-buka nampil hasil terbaru.
  if (rollState.mini) syncRollMiniStrip();

  // Kartu hasil roll = SALINAN persis kartu lobby (hubCardHtml) supaya posisinya identik.
  const eq = {char:result.cardId, mut:result.mut||"none", shiny:!!result.shiny, trait:"none"};
  showcase.innerHTML = hubCardHtml(eq);
  const mut = eq.mut!=="none" ? eq.mut : null;
  showcase.style.borderColor = mut ? MUT_COLOR[mut] : (TIER_COLOR[CARDS[eq.char].tier] || "var(--cyan)");
  showcase.style.setProperty('--tcol', mut ? (MUT_COLOR[mut] || '#7DF9FF') : (TIER_COLOR[CARDS[eq.char].tier] || '#7DF9FF'));

  // Buka overlay. Animasi masuk HANYA sekali (saat pertama tampil) supaya tidak flicker muncul-hilang tiap tick.
  const wasVisible = overlay.style.display === 'flex';
  overlay.style.display = 'flex';
  /* fix: reveal non-mini harus bersih dari bottom inline sisa mode mini (position:relative → geser naik) */
  if (!rollState.mini) showcase.style.bottom = '';
  // Cinematic reveal (port dari _tmp/reveal-proto): slam + flash + particles - hanya saat baru buka
  if (!wasVisible && !rollState.mini) {
    showcase.style.transition = 'none';
    showcase.classList.remove('rv-slam'); void showcase.offsetWidth; showcase.classList.add('rv-slam');
    const tcol = mut ? (MUT_COLOR[mut] || '#7DF9FF') : (TIER_COLOR[CARDS[eq.char].tier] || '#7DF9FF');
    setTimeout(() => rvFx(showcase, overlay, tcol), 560);
  } else {
    showcase.classList.remove('rv-slam');
    showcase.style.transition = '';
    showcase.style.opacity = '1';
    showcase.style.transform = 'scale(1)';
  }

  // Tutup lewat klik di mana saja diikat di wireRollDock (overlay), bukan tombol lagi.
  // Update chance display: pakai base MENTAH (result.chance = base × statMult), bukan yang dibagi luck.
  if(result.chance!==undefined){
    const ec=document.querySelector('.roll-card-showcase .hc-chance');
    if(ec)ec.textContent="1 in "+fmt(result.chance);
  }
}

// Modal profil: open/close + update data
function openProfileModal(){const b=document.getElementById("profBackdrop");const m=document.getElementById("profModal");if(b){b.classList.add("show");b.style.display="block";}if(m){m.classList.add("show");m.style.display="flex";renderProfile();}}
function closeProfileModal(){const b=document.getElementById("profBackdrop");const m=document.getElementById("profModal");if(b){b.classList.remove("show");b.style.display="none";}if(m){m.classList.remove("show");m.style.display="none";}}
function renderProfile(){
  if(!state)return;
  const body=document.getElementById("profBody");
  if(!body)return;
  const p=state.player||{};
  const lv=p.lv||state.playerLv||1;
  const xpNeed=lv*1000, curExp=p.exp||0;
  const xpPct=Math.max(0,Math.min(100,Math.round(curExp/xpNeed*100)));
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  /* ---- hero kiri: title tag + avatar kartu utama + nama/level/XP ---- */
  const eq=equipped(); const cid=eq&&eq.char;
  const av=document.getElementById("pfAv");
  if(av){
    const art=(cid&&CARDS[cid])?cardImg(cid):"";
    if(art){
      const pos=CARDS[cid].pos?` style="object-position:${CARDS[cid].pos}"`:"";
      av.innerHTML=`<img src="${art}" alt=""${pos}>`;
    }else{
      av.innerHTML='<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6.5 8-6.5S20 16 20 20"/></svg>';
    }
  }
  set("pfName",currentUser||"GUEST");
  set("pfDeck",cid?("KARTU UTAMA · "+cardName(cid)):"KARTU UTAMA · —");
  set("pfLv",lv);
  const xf=document.getElementById("pfXpFill");if(xf)xf.style.width=xpPct+"%";
  set("pfXpText",`${fmt(curExp)} / ${fmt(xpNeed)} · ${xpPct}%`);
  set("pfTitleTag",cid?("["+cardName(cid).toUpperCase()+"]"):"[UNRANKED]");
  const tb=document.getElementById("pfTitlesBtn");
  if(tb)tb.onclick=()=>{body.scrollTo({top:0,behavior:"smooth"});};
  /* ---- helper tile/seksi/row ---- */
  const tile=(lab,val,sub,tcls,vcls)=>`<div class="prof-tile${tcls?" "+tcls:""}"><span class="prof-tl">${lab}</span><span class="prof-tv${vcls?" "+vcls:""}">${val}</span>${sub?`<span class="prof-ts">${sub}</span>`:""}</div>`;
  const sec=(t,grid)=>`<section class="prof-sec"><h3 class="prof-sec-t">${t}</h3><div class="prof-grid">${grid}</div></section>`;
  const row=(lab,val)=>`<div class="prof-row"><span class="prof-rl">${lab}</span><span class="prof-rv">${val}</span></div>`;
  /* ===== ANGKA INTI: stat rows gaya referensi ===== */
  const base=p.luckBase??1, flat=p.luckFlat||0, treeF=treeLuckFlat(), treeP=treeLuckPct(), artF=artLuckFlat(), artP=artLuckPct(), petF=petLuckFlat(), petP=petLuckPct(), plB=activeLuckBuff(), plBP=activeLuckBuffPct();
  const pct=(p.luckPercent||0)+treeLuckPct()+plBP+artP+petP;
  const wm=weatherLuckMult();
  const lparts=["Base "+base.toFixed(1)];
  if(flat>0)lparts.push("Player +"+flat.toFixed(1));
  if(treeF>0)lparts.push("Pohon +"+treeF.toFixed(1));
  if(artF>0||artP>0)lparts.push("Artefak +"+artF.toFixed(1)+(artP>0?" / +"+Math.round(artP*100)+"%":""));
  if(petF>0||petP>0)lparts.push("Pet +"+petF.toFixed(1)+(petP>0?" / +"+Math.round(petP*100)+"%":""));
  if(plB>0||plBP>0)lparts.push("Buff +"+plB.toFixed(1)+(plBP>0?" / +"+Math.round(plBP*100)+"%":""));
  if(pct>0)lparts.push("Pct +"+Math.round(pct*100)+"%");
  if(wm>1)lparts.push("Cuaca ×"+wm.toFixed(1));
  const spm=playerSpeedMult(), swm=weatherSpeedMult();
  const eff=Math.min(spm*swm,RNG_ROLL_MAX_MULT);
  const sparts=[];if(spm>1)sparts.push("Pohon/Buff ×"+spm.toFixed(1));if(swm>1)sparts.push("Cuaca ×"+swm.toFixed(1));
  const bsMax=battleSpeedMax();
  const bsNext=bsMax<4?("Berikutnya: "+(bsMax===1?"LV25 → 2×":bsMax===2?"LV50 → 3×":"LV100 → 4×")):"Semua kecepatan terbuka";
  const pfStats=document.getElementById("pfStats");
  if(pfStats)pfStats.innerHTML=
    row("BATTLE POWER",fmt(totalPower()))
    +row("CURRENT LUCK",totalLuck().toFixed(1)+"×")
    +row("TREE LUCK","+"+treeF.toFixed(1)+(treeP>0?" / +"+Math.round(treeP*100)+"%":""))
    +row("ITEM LUCK","+"+(artF+petF).toFixed(1)+((artP+petP)>0?" / +"+Math.round((artP+petP)*100)+"%":""))
    +row("ROLL SPEED",eff.toFixed(1)+"×");

  /* ===== PARTY: pet + 2 artefak + kartu utama (portrait + pill) ===== */
  const pslot=(img,label,pill,name)=>`<div class="prof-slot${img?"":" empty"}" title="${name}">${img?`<img src="${img}" alt="">`:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>'}<span class="ps-lab">${label}</span><span class="ps-pill">${pill}</span></div>`;
  const pd=state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;
  const slots=[];
  slots.push(pslot(pd?`assets/pets/${pd.id}.png`:"","PET",pd?`+${pd.flat||0}${pd.pct?" / +"+Math.round(pd.pct*100)+"%":""}`:"KOSONG",pd?pd.name:"Pet kosong"));
  [0,1].forEach(i=>{
    const aid=state.artSlots&&state.artSlots[i];
    const ad=aid?ART_DEFS.find(x=>x.id===aid):null;
    slots.push(pslot(ad?(ad.img||""):"","ARTEFAK "+(i+1),ad?`+${ad.flat||0}${ad.pct?" / +"+ad.pct+"%":""}`:"KOSONG",ad?ad.name:"Artefak kosong"));
  });
  slots.push(pslot(cid?cardImg(cid):"","KARTU",cid?`1 IN ${fmt(effChance(cid))}`:"KOSONG",cid?cardName(cid):"Tanpa kartu"));
  const pfParty=document.getElementById("pfParty");if(pfParty)pfParty.innerHTML=slots.join("");
  /* ===== GACHA: luck lengkap, speed, battle speed, power, summon ===== */
  const gacha=
    tile("TOTAL LUCK",totalLuck().toFixed(1)+"×",lparts.join(" · "),"wide accent","big")
    +tile("ROLL SPEED",eff.toFixed(1)+"×",sparts.length?sparts.join(" · ")+" · cap ×5":"Tanpa bonus · cap ×5")
    +tile("BATTLE SPEED",battleSpeedEff()+"×",`Maks ${bsMax}× · ${bsNext}`)
    +tile("TOTAL POWER",fmt(totalPower()),"HP + ATK deck aktif")
    +tile("TOTAL SUMMON",fmt(state.summons||0),"pull sepanjang masa");
  /* ===== KOLEKSI: dari state.stacks ===== */
  const st=Array.isArray(state.stacks)?state.stacks:[];
  let copies=0, shiny=0, gold=0, rainbow=0, secret=0; const uni=new Set();
  for(const s of st){const c=s.count||1;copies+=c;uni.add(s.char);
    if(s.shiny)shiny+=c;const m=s.mut||"none";
    if(m==="gold")gold+=c;else if(m==="rainbow")rainbow+=c;else if(m==="secret")secret+=c;}
  const totalCards=MASTER_CARD_INDEX.length;
  const uniPct=totalCards?Math.round(uni.size/totalCards*100):0;
  const koleksi=
    tile("KARTU UNIK",`${uni.size} / ${totalCards}`,`progres koleksi ${uniPct}%`)
    +tile("TOTAL COPY",fmt(copies),"seluruh salinan kartu")
    +tile("SHINY",fmt(shiny),"salinan shiny")
    +tile("GOLD",fmt(gold),"mutasi gold")
    +tile("RAINBOW",fmt(rainbow),"mutasi rainbow")
    +tile("SECRET",fmt(secret),"mutasi secret");
  /* ===== PROGRES: tower, story per diff, raid, SP, harian ===== */
  const cd=(state.clearedDiff&&typeof state.clearedDiff==="object")?state.clearedDiff:{};
  const storyTiles=DIFFS.map(d=>{const n=Object.keys(cd[d.k]||{}).length;
    return tile("STORY "+d.l,`${n}/${LEVEL_COUNT}`,`${LEVEL_COUNT?Math.round(n/LEVEL_COUNT*100):0}% selesai`);}).join("");
  const raidDone=RAID_DIFFS.filter(d=>state.raidCleared&&state.raidCleared[d.k]).length;
  const raidSub=RAID_DIFFS.map(d=>{const ok=state.raidCleared&&state.raidCleared[d.k];
    return `<b class="${ok?"prof-ok":"prof-off"}">${d.l} ${ok?"✓":"✗"}</b>`;}).join(" · ");
  const di=state.dailyIndex||0;
  const progres=
    tile("INFINITE TOWER",`Lantai ${(state.tower&&state.tower.best)||0}`,((state.tower&&state.tower.auto)?"AUTO RESTART: AKTIF":"AUTO RESTART: MATI"))
    +tile("SKILL POINT",`${p.sp||0}`,"untuk talent tree")
    +tile("HADIAH HARIAN",`HARI ${di+1} / 7`,`berikutnya +${fmt(DAILY_REWARDS[di]||0)} coin`)
    +storyTiles
    +tile("BOSS RAID",`${raidDone} / ${RAID_DIFFS.length}`,raidSub,"wide");
  /* ===== EKUIPMEN: artefak + pet dengan kontribusi luck ===== */
  const artTile=i=>{const id=state.artSlots&&state.artSlots[i];
    const d=id?ART_DEFS.find(x=>x.id===id):null;
    if(!d)return tile("ARTEFAK "+(i+1),"KOSONG","slot belum terpasang");
    const b=[];if(d.flat)b.push("+"+d.flat+" flat");if(d.pct)b.push("+"+d.pct+"%");
    return tile("ARTEFAK "+(i+1),d.name,b.length?b.join(" · "):"tanpa bonus luck");};
  const petB=[];if(pd){if(pd.flat)petB.push("+"+pd.flat+" flat");if(pd.pct)petB.push("+"+Math.round(pd.pct*100)+"%");}
  const equip=
    artTile(0)+artTile(1)
    +tile("PET",pd?pd.name:"TIDAK ADA",pd?(petB.length?petB.join(" · "):"tanpa bonus luck"):"belum ada pet dipakai")
    +tile("ARTEFAK DIMILIKI",`${(state.artOwned||[]).length} / ${ART_DEFS.length}`,"total koleksi artefak")
    +tile("PET DIMILIKI",`${(state.petOwned||[]).length} / ${PET_DEFS.length}`,"total koleksi pet")
    +tile("DEV UNLOCK",`<button class="prof-unbtn" onclick="devUnlockAll()">BUKA SEMUA PET & ARTEFAK</button>`,"langsung penuh - idempoten","accent");
  /* ===== ITEM & BUFF: token, potion, cuaca & buff aktif (countdown live) ===== */
  const wAct=(state.weather&&Date.now()<state.weather.endsAt)?WEATHER[state.weather.id]:null;
  const wSub=wAct?`sisa ${fmtCountdown(state.weather.endsAt-Date.now())} · Luck ×${wAct.luckBonus} · Speed ×${wAct.speedBonus}`:"siklus alami 30 menit";
  const lb=plB, sb=activeSpeedBuff();
  const bparts=[];
  luckBuffs().slice().sort((a,b)=>a.lv-b.lv).forEach(b=>{
    const q=b.pct||0;
    bparts.push(`Luck ${b.lv>0?"L"+b.lv+" ":""}+${b.flat||0}${q>0?' / +'+Math.round(q*100)+'%':''} · sisa ${fmtCountdown(b.endsAt-Date.now())}`);
  });
  speedBuffs().slice().sort((a,b)=>a.lv-b.lv).forEach(b=>{
    bparts.push(`Speed ${b.lv>0?"L"+b.lv+" ":""}+${(b.add||0).toFixed(1)}× · sisa ${fmtCountdown(b.endsAt-Date.now())}`);
  });
  const item=
    tile("COIN",fmt(state.coins||0),"")
    +tile("TOKEN RAID",fmt(state.raidTokens||0),"dari Boss Raid")
    +tile("TOKEN INF",fmt(state.infTokens||0),"mata Infinite Tower")
    +tile("WEATHER POTION",`×${state.potions||0}`,"skip cuaca 5 menit")
    +tile("MYTHIC POTION",`×${state.mythicPotions||0}`,"reroll + APOCALYPSE 3%")
    +tile("LUCK POTION",`L1 ×${fmt((state.luckPots||[])[0]||0)} · L2 ×${fmt((state.luckPots||[])[1]||0)} · L3 ×${fmt((state.luckPots||[])[2]||0)}`,"buff luck sementara")
    +tile("SPEED POTION",`L1 ×${fmt((state.speedPots||[])[0]||0)} · L2 ×${fmt((state.speedPots||[])[1]||0)} · L3 ×${fmt((state.speedPots||[])[2]||0)}`,"buff speed sementara")
    +tile("CUACA AKTIF",wAct?`${wAct.icon} ${wAct.name}`:"TIDAK AKTIF",wSub,"wide")
    +tile("BUFF AKTIF",(lb>0||sb>0)?"AKTIF":"TIDAK AKTIF",bparts.length?bparts.join(" · "):"pakai potion untuk buff sementara","wide");
  /* ===== TITLES: judul pencapaian (tombol TITLES scroll ke seksi ini) ===== */
  const titles=[
    {n:"ROOKIE ROLLER",d:"Roll kartu pertama",ok:(state.summons||0)>=1},
    {n:"COLLECTOR",d:"Kumpulkan 10 kartu unik",ok:uni.size>=10},
    {n:"SHINY HUNTER",d:"Dapatkan 1 kartu shiny",ok:shiny>=1},
    {n:"TOWER CLIMBER",d:"Capai lantai 10 Infinite Tower",ok:((state.tower&&state.tower.best)||0)>=10},
    {n:"RAID SLAYER",d:"Kalahkan 1 boss raid",ok:raidDone>=1},
    {n:"ELITE",d:"Capai level 25",ok:lv>=25}
  ];
  const titlesGrid=titles.map(t=>tile(t.n,t.ok?"✓ DIRAIH":"· belum",t.d,t.ok?"accent":"",t.ok?"prof-ok":"")).join("");
  body.innerHTML=
    sec("TITLES",titlesGrid)
    +sec("GACHA",gacha)
    +sec("KOLEKSI",koleksi)
    +sec("PROGRES",progres)
    +sec("EKUIPMEN",equip)
    +sec("ITEM & BUFF",item);
}



function hideRollResult() {
  const overlay = document.getElementById('rollOverlay');
  if (!overlay) return;
  const wasMini = rollState.mini; /* fix: jangan un-mini dulu - fade di tempat biar card nggak loncat ke tengah */
  
  const showcase = overlay.querySelector('.roll-card-showcase');
  if (showcase) {
    showcase.classList.remove('rv-slam');
    showcase.style.transition = 'all 0.3s ease-out';
    showcase.style.opacity = '0';
    showcase.style.transform = 'scale(0.8)';
  }
  
  rollState.fadeTimer = setTimeout(() => {
    rollState.fadeTimer = null;
    if (wasMini) setRollMini(false);
    overlay.style.display = 'none';
    if (showcase) {
      showcase.style.opacity = '';
      showcase.style.transform = '';
      showcase.style.transition = '';
      showcase.style.bottom = ''; /* fix: buang sisa bottom inline mini waktu fade-out selesai */
    }
  }, 300);
}

function setRollMini(on) {
  const overlay = document.getElementById('rollOverlay');
  if (!overlay) return;
  rollState.mini = !!on;
  if (!rollState.mini) rollState.collapsed = false;
  if (rollState.mini && rollState.hideTimer) { clearTimeout(rollState.hideTimer); rollState.hideTimer = null; }
  if (rollState.fadeTimer) { clearTimeout(rollState.fadeTimer); rollState.fadeTimer = null; }
  overlay.classList.toggle('mini', rollState.mini);
  /* fix: buang sisa bottom inline dari mode mini - kalau nggak, kartu non-mini (position:relative)
     kegeser naik ±110px pas reveal berikutnya ("card naik ke atas" pas AUTO nyala lagi). */
  if (!rollState.mini) {
    const card = overlay.querySelector('.roll-card-showcase');
    if (card) card.style.bottom = '';
  }
  syncRollMiniStrip();
}

// Strip kecil: teks "hide" pas kartu nampil, "▲ buka" pas kartu di-hide (collapsed).
function syncRollMiniStrip() {
  const strip = document.getElementById('rollMiniStrip');
  if (!strip) return;
  const overlay = document.getElementById('rollOverlay');
  if (overlay) overlay.classList.toggle('collapsed', !!rollState.collapsed);
  strip.textContent = rollState.collapsed ? '▲ buka reveal' : '▾ hide';
  positionMiniReveal();
}

// Letakin strip + kartu mini TEPAS di atas footer (tinggi footer bisa berubah pas weather on/off).
function positionMiniReveal() {
  const overlay = document.getElementById('rollOverlay');
  if (!overlay || !rollState.mini) return;
  const footer = document.querySelector('.lobby-footer');
  const strip = document.getElementById('rollMiniStrip');
  const card = overlay.querySelector('.roll-card-showcase');
  let footFromBottom = 78; // fallback
  if (footer) {
    const r = footer.getBoundingClientRect();
    if (r.height > 0) footFromBottom = window.innerHeight - r.top;
  }
  const stripBottom = footFromBottom + 8;
  if (strip) strip.style.bottom = stripBottom + 'px';
  if (card) card.style.bottom = (stripBottom + 22 + 6) + 'px';
}

/* ========== DECK MANAGER (panel Backpack) ==========
   Backpack = editor dek 4 slot berbasis state.stacks + state.deck.
   Tile koleksi dibuat KECIL & TANPA info stat biar muat banyak.
   Alur: klik slot => jadikan target; klik tile koleksi => pasang ke target (atau slot kosong pertama). */
let bpTarget = null;
let bpMutFilter = "all"; /* filter varian koleksi: all|none|gold|rainbow|secret|shiny */
let bpTab = "deck"; /* tab Backpack: deck | item | artefact | pet */
function bpSetTab(t){bpTab=t;bpTarget=null;bpItemPopClose();renderBackpackPanel();}
function deckTotalPower(){return equippedList().reduce((a,s)=>{const st=cardStats(s.char,s.mut,s.trait,s.shiny);return a+(st.hp+st.atk);},0);}
function bpPickSlot(i){bpTarget=(bpTarget===i?null:i);renderBackpackPanel();}
function bpSetFilter(m){bpMutFilter=m;renderBackpackPanel();}
function bpMatchesMut(s){return bpMutFilter==="all"||(bpMutFilter==="shiny"?!!s.shiny:(s.mut||"none")===bpMutFilter);}
function bpClearSlot(i){setDeckSlot(i,null);bpTarget=null;renderBackpackPanel();}
function bpAssign(stackId){
  const s=state.stacks.find(x=>x.id===stackId);if(!s)return;
  let slot=bpTarget;
  if(slot==null)slot=state.deck.indexOf(null);
  if(slot<0)slot=0;                 /* dek penuh: timpa slot pertama */
  setDeckSlot(slot,s.id);
  bpTarget=null;
  renderBackpackPanel();
}
function bpFav(stackId){const s=state.stacks.find(x=>x.id===stackId);if(!s)return;s.fav=!s.fav;save();renderBackpackPanel();}
function bpLock(stackId){const s=state.stacks.find(x=>x.id===stackId);if(!s)return;s.lock=!s.lock;save();renderBackpackPanel();}
function renderBackpackPanel(){
  const panel=document.getElementById('backpackPanel');if(!panel)return;
  bpsHoverBind();bpsHoverHide();
  const TABS=[{k:'deck',l:'DECK'},{k:'tree',l:'TREE'},{k:'item',l:'ITEM'},{k:'artefact',l:'ARTEFAK'},{k:'pet',l:'PET'}];
  const tabbar=`<div class="bp-tabs">${TABS.map(t=>`<button class="bp-tab${bpTab===t.k?' on':''}" onclick="bpSetTab('${t.k}')">${t.l}</button>`).join('')}</div>`;
  const header=`<div class="backpack-header"><h2>BACKPACK</h2>
    <button class="backpack-close" onclick="toggleBackpack()">&times;</button></div>${tabbar}`;
  if(bpTab==='tree'){panel.innerHTML=header+`<div class="bp-body tree">${renderBpTree()}</div>`;stMount();return;}
  if(bpTab==='item'){panel.innerHTML=header+`<div class="bp-body">${renderBpItems()}</div>`;return;}
  if(bpTab==='artefact'){panel.innerHTML=header+`<div class="bp-body">${renderBpArts()}</div>`;return;}
  if(bpTab==='pet'){panel.innerHTML=header+`<div class="bp-body">${renderBpPets()}</div>`;return;}
  /* tab DECK (default) */
  if(!state.stacks.length){panel.innerHTML=header+`<div class="bp-empty">Belum punya kartu. Tekan &#127922; untuk Roll.</div>`;return;}
  const slots=[0,1,2,3].map(i=>{
    const id=state.deck[i];const s=id?state.stacks.find(x=>x.id===id):null;
    if(!s)return `<div class="bp-slot${bpTarget===i?' sel':''}" onclick="bpPickSlot(${i})"><span class="bps-plus">+</span><span class="bps-num">${i+1}</span></div>`;
    return `<div class="bp-slot filled${bpTarget===i?' sel':''}" data-sid="${s.id}" onclick="bpPickSlot(${i})" style="--tcol:${TIER_COLOR[s.tier]};border-color:${TIER_COLOR[s.tier]}"><img src="${cardImg(s.char)}" alt=""><span class="bps-num">${i+1}</span><button class="bps-x" onclick="event.stopPropagation();bpClearSlot(${i})">&times;</button></div>`;
  }).join('');
  const visible=state.stacks.filter(bpMatchesMut).sort((a,b)=>(b.fav?1:0)-(a.fav?1:0)); /* favorit → baris atas */
  const tiles=visible.map(s=>{
    const inDeck=state.deck.includes(s.id);
    const shny=s.shiny?'<span class="bpt-shiny">SHINY</span>':'';
    const mut=(s.mut&&s.mut!=='none')?s.mut:null;
    const trait=(s.trait&&s.trait!=='none')?s.trait:null;
    const cnt=(s.count||1)>1?`<span class="bpt-cnt">&times;${fmt(s.count)}</span>`:'';
    const stack=(shny||mut||trait)?`<div class="bpt-top">${shny}${mut?mutChip(mut,`<span class="bpt-mut" style="border-color:${MUT_COLOR[mut]}">${mutBadge(mut)}</span>`):''}${trait?traitChip(trait,`<span class="bpt-gem" style="border-color:${TRAIT_COLOR[trait]}">${traitGem(12,trait)}</span>`):''}</div>`:'';
    return `<div class="bp-tile${inDeck?' in-deck':''}" data-sid="${s.id}" data-name="${cardName(s.char).toLowerCase()}" onclick="bpAssign('${s.id}')" style="--tcol:${TIER_COLOR[s.tier]}"><img src="${cardImg(s.char)}" alt="">${stack}${cnt}<div class="bpt-ctl"><button class="bpt-fav${s.fav?' on':''}" onclick="event.stopPropagation();bpFav('${s.id}')" title="Favorit">${s.fav?'★':'☆'}</button><button class="bpt-lock${s.lock?' on':''}" onclick="event.stopPropagation();bpLock('${s.id}')" title="Lock">${s.lock?'🔒':'🔓'}</button></div><div class="bpt-name">${cardName(s.char)}</div></div>`;
  }).join('');
  const cntOf=m=>state.stacks.filter(s=>m==='all'?true:(m==='shiny'?!!s.shiny:(s.mut||'none')===m)).length;
  const chip=(k,lbl)=>{const on=bpMutFilter===k;const col=!on?(MUT_COLOR[k]||'#7DF9FF'):'';return `<button class="bp-fchip${on?' on':''}" onclick="bpSetFilter('${k}')"${col?` style="border-color:${col};color:${col}"`:''}>${lbl}<em>${cntOf(k)}</em></button>`;};
  const searchInput=`<input class="bp-search" type="search" placeholder="🔍 Cari kartu…" value="${deckSearch}" oninput="deckSearch=this.value;runCardSearch(this,document.querySelector('.bp-tiles'),document.getElementById('bp-nores'))">`;
  const filterRow=`<div class="bp-filter">${searchInput}${chip('all','SEMUA')+chip('shiny','SHINY')+chip('gold','GOLD')+chip('rainbow','RAINBOW')+chip('secret','SECRET')}</div>`;
  panel.innerHTML=header+`<div class="bp-body deck"><div class="bp-cols">
    <div class="bp-h">DECK AKTIF</div>
    <div class="bp-deckcol">
      <div class="bp-slots">${slots}</div><div class="bp-deckmeta"><span class="bdm-l">TOTAL POWER</span><b class="bdm-v">${fmt(deckTotalPower())}</b><button class="bp-save" onclick="beep(660,.08);toast('DECK TERSIMPAN','SIAP DIPAKAI','#7DF9FF')">SIMPAN DECK</button></div>
    </div>
    <div class="bp-collect">
      <div class="bp-colhead">${filterRow}<div class="bp-h">KOLEKSI</div></div>
      ${visible.length?`<div class="bp-scroll"><div class="bp-tiles">${tiles}</div><div class="bp-empty" id="bp-nores" style="display:none;padding:18px 0">Kartu tidak ditemukan.</div></div>`:`<div class="bp-empty" style="padding:18px 0">Tidak ada kartu varian ini.</div>`}
    </div>
  </div></div>`;
  /* terapkan ulang query search setelah re-render (misal toggle ★) — query disimpan di deckSearch */
  const si=document.getElementById('bp-search');
  if(si&&deckSearch)runCardSearch(si,document.querySelector('.bp-tiles'),document.getElementById('bp-nores'));
}
/* Tab ITEM di backpack: tile icon ringkas; klik -> popup konfirmasi PAKAI. Item: Weather / Luck / Speed Potion. */
function bpItemDef(kind){
  if(kind==='potion'){const aw=activeWeatherId();return{kind,name:'WEATHER POTION',icon:'assets/images/icon-potion.png',emoji:'🧪',cnt:state.potions||0,
    desc:'Gacha cuaca · chance asli + pity. Hasil sama/lebih bagus = pindah + timer reset 5 menit; lebih jelek = cuaca tetep.',
    active:aw?`<br><strong style="color:${WEATHER[aw].color}">Aktif: ${WEATHER[aw].icon} ${WEATHER[aw].name}</strong>`:'',use:'bpUsePotion()'};}
  if(kind.startsWith('luck')){const lv=+kind[4],d=LUCK_POTS[lv],b=activeLuckBuff(),bp=activeLuckBuffPct();return{kind,name:'LUCK POTION L'+lv,icon:`assets/images/pot-luck-${lv}.png`,emoji:'🍀',cnt:(state.luckPots&&state.luckPots[lv-1])||0,
    desc:`+${d.flat} flat luck${d.pct?` & +${Math.round(d.pct*100)}% luck`:''} selama 5 menit per pot. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.`,
    active:b||bp?`<br><strong style="color:#5eead4">Aktif: +${b} LUCK${bp?` · +${Math.round(bp*100)}%`:''}</strong>`:'',use:`bpUseLuckPotion(${lv},1)`,useAll:`bpUseLuckPotion(${lv},'all')`};}
  if(kind.startsWith('speed')){const lv=+kind.slice(-1),d=SPEED_POTS[lv],b=activeSpeedBuff();return{kind,name:'SPEED POTION L'+lv,icon:`assets/images/pot-speed-${lv}.png`,emoji:'⚡',cnt:(state.speedPots&&state.speedPots[lv-1])||0,
    desc:`Roll speed +${d.add.toFixed(1)}× selama 5 menit per pot (cap total ×5). Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.`,
    active:b?`<br><strong style="color:#fcd34d">Aktif: +${b.toFixed(1)}× SPEED</strong>`:'',use:`bpUseSpeedPotion(${lv},1)`,useAll:`bpUseSpeedPotion(${lv},'all')`};}
  if(kind==='mythic'){const aw=activeWeatherId();return{kind,name:'MYTHIC WEATHER POTION',icon:'assets/images/icon-mythic.png',emoji:'✨',cnt:state.mythicPotions||0,
    desc:'Sama kayak Weather Potion, tapi AWAKENED chance 3%.',
    active:aw?`<br><strong style="color:${WEATHER[aw].color}">Aktif: ${WEATHER[aw].icon} ${WEATHER[aw].name}</strong>`:'',use:'bpUseMythicPotion()'};}
  if(kind==='intan'){return{kind,name:'INTAN ROLL 100K',icon:'assets/images/icon-intan.png',emoji:'💎',cnt:state.intanRolls||0,
    desc:'ITEM INDEX REWARD — didapat otomatis tiap 5 varian kartu terkumpul di Card Index (semua mutasi + varian shiny dihitung). Pakai = langsung menarik 100.000 roll kartu ke koleksi.',
    active:'',use:'bpUseIntanRoll()'};}
  return null;
}
function renderBpItems(){
  const kinds=['potion','mythic','luck1','luck2','luck3','speed1','speed2','speed3','intan'];
  const tiles=kinds.map(k=>{const d=bpItemDef(k);return `<div class="bp-itemtile${d.cnt>0?'':' empty'}" onclick="bpItemPop('${k}')"><div class="bp-itemtile-ic"><img src="${d.icon}" alt="${d.name}" onerror="this.parentNode.textContent='${d.emoji}'"></div><span class="bp-itemtile-cnt">×${fmt(d.cnt)}</span></div>`;}).join('');
  return `<div class="bp-h">ITEM</div><div class="bp-itemgrid">${tiles}</div>`;
}
function bpItemPop(kind){
  bpItemPopClose();
  const d=bpItemDef(kind); if(!d)return;
  const isGacha=(kind==='potion'||kind==='mythic');
  const odds=isGacha?weatherOddsHTML():'';
  const multi=isGacha?`<div class="wo-multi">${[1,5,25,100].map(n=>`<button data-n="${n}" class="${bpMultiN===n?'on':''}" onclick="bpSetMulti(${n})">${n}×</button>`).join('')}</div>`:'';
  const canUse=d.cnt>0;
  const el=document.createElement('div'); el.id='itemPop';
  el.innerHTML=`<div class="item-pop-back" onclick="bpItemPopClose()"></div>
    <div class="item-pop">
      <div class="item-pop-ic"><img src="${d.icon}" alt="${d.name}" onerror="this.parentNode.textContent='${d.emoji}'"></div>
      <div class="item-pop-name">${d.name}</div>
      <div class="item-pop-cnt">Punya: ×${fmt(d.cnt)}</div>
      <div class="item-pop-desc">${d.desc}${d.active||''}</div>
      ${odds}
      ${multi}
      <div class="item-pop-ctl">
        <button class="bpi-use" ${canUse?'':'disabled'} onclick="${d.use}">PAKAI${isGacha&&bpMultiN>1?' ×'+bpMultiN:''}</button>
        ${d.useAll&&d.cnt>1?`<button class="bpi-use bpi-all" ${canUse?'':'disabled'} onclick="${d.useAll}">GABUNG SEMUA ×${fmt(d.cnt)}</button>`:''}
        <button class="item-pop-cancel" onclick="bpItemPopClose()">BATAL</button>
      </div>
    </div>`;
  document.body.appendChild(el);
}
/* Toggle jumlah roll gacha (1 / 5 / 25 / 100) di popup potion. */
let bpMultiN=1;
function bpSetMulti(n){
  bpMultiN=n;
  document.querySelectorAll('#itemPop .wo-multi button').forEach(b=>b.classList.toggle('on',+b.dataset.n===n));
  const use=document.querySelector('#itemPop .bpi-use');
  if(use&&bpMultiN>1)use.textContent='PAKAI ×'+bpMultiN;
  else if(use)use.textContent='PAKAI';
}
function bpItemPopClose(){const e=document.getElementById('itemPop');if(e)e.remove();}
/* ===== PANEL WEATHER ODDS (popup Weather / Mythic Potion):
   2 bar pity + daftar chance ASLI per kelas (RARE -> COMMON, langka dulu).
   Chance = odds dasar — pity override gak dimasukin biar angka tetep jujur. ===== */
function weatherOddsHTML(){
  const p=(state&&state.wpity)||{r:0,m:0};
  const rLeft=Math.max(0,PITY_RARE-(p.r||0)),mLeft=Math.max(0,PITY_MYTHIC-(p.m||0));
  const pity=(label,v,max,cls)=>`<div class="wo-pity">
      <div class="wo-pity-top"><span>${label}</span><b>Guaranteed in ${fmt(v)}</b></div>
      <div class="wo-bar ${cls}"><i style="width:${Math.min(100,(max-v)/max*100).toFixed(1)}%"></i></div>
    </div>`;
  const sec=(rar,label)=>{
    const list=WEATHERS.filter(w=>w.rar===rar).sort((a,b)=>a.dropWeight-b.dropWeight);
    return `<div class="wo-sec"><div class="wo-sec-h ${rar.toLowerCase()}">${label}</div>`+
      list.map(w=>{
        const pct=w.dropWeight/100;
        const pctS=pct<1?pct.toFixed(2):pct.toFixed(1);
        const inv=10000/w.dropWeight;
        const invS=inv<10?inv.toFixed(1):fmt(Math.round(inv));
        return `<div class="wo-row"><span class="wo-ic">${w.icon}</span><span class="wo-nm">${w.name}</span><span class="wo-pct">${pctS}%</span><span class="wo-inv">1 in ${invS}</span></div>`;
      }).join("")+`</div>`;
  };
  return `<div class="wo-wrap">
    <div class="wo-h">WEATHER ODDS</div>
    ${pity("RARE PITY",rLeft,PITY_RARE,"wo-r")}
    ${pity("MYTHIC PITY",mLeft,PITY_MYTHIC,"wo-m")}
    ${sec("AWAKENED","AWAKENED")}${sec("ARCANE","ARCANE")}${sec("RARE","RARE")}${sec("UNCOMMON","UNCOMMON")}${sec("COMMON","COMMON")}
  </div>`;
}
function bpUsePotion(){
  const n=bpMultiN;let done=0,switches=0,kept=0,best=null,last=null;
  for(let i=0;i<n;i++){
    const r=useWeatherPotion();
    if(!r.ok)break;
    done++;last=r.weather;
    if(r.kept)kept++;else{switches++;if(!best||r.weather.dropWeight<best.dropWeight)best=r.weather;}
  }
  if(!done){
    toast("Potion habis","GAK ADA POTION","#f87171");
    return;
  }
  if(n>1){
    const w=best||last;
    toast(`${w?w.icon+' '+w.name:'GACHA ×'+done}`,`×${done} ROLL · ${switches} PINDAH · ${kept} SKIP`,w?w.color:'#5eead4');
    if(switches)beep(520,.16,"triangle",.1),setTimeout(()=>beep(780,.18,"triangle",.1),120);
    else beep(240,.18,"sine",.07);
  }else if(last&&best===null&&kept){
    toast(`${last.icon} ${last.name}`,"ROLL LEBIH JELEK · CUACA TETEP",last.color);
    beep(240,.18,"sine",.07);
  }else{
    beep(520,.16,"triangle",.1);setTimeout(()=>beep(780,.18,"triangle",.1),120);
    toast(`${best.icon} ${best.name}`,"WEATHER AKTIF · 5 MENIT",best.color);
  }
  renderShell();renderBackpackPanel();bpItemPop('potion');
}
function bpUseLuckPotion(lv,all){
  const cnt=(state.luckPots&&state.luckPots[lv-1])||0;
  const n=all==='all'?cnt:1;
  const r=useLuckPotion(lv,n);
  if(!r.ok){toast("Potion habis","GAK ADA POTION","#f87171");return;}
  beep(560,.14,"triangle",.09);setTimeout(()=>beep(820,.14,"triangle",.08),110);
  toast("LUCK POTION L"+lv+(n>1?" ×"+n:""),"+"+r.flat+" LUCK"+(r.pct?" · +"+Math.round(r.pct*100)+"%":"")+" · "+Math.round(r.ms/60000)+" MENIT","#5eead4");
  bpItemPopClose();renderShell();renderBackpackPanel();
}
function bpUseSpeedPotion(lv,all){
  const cnt=(state.speedPots&&state.speedPots[lv-1])||0;
  const n=all==='all'?cnt:1;
  const r=useSpeedPotion(lv,n);
  if(!r.ok){toast("Potion habis","GAK ADA POTION","#f87171");return;}
  beep(720,.14,"square",.08);setTimeout(()=>beep(980,.14,"square",.07),110);
  toast("SPEED POTION L"+lv+(n>1?" ×"+n:""),"SPEED +"+r.add.toFixed(1)+"× · "+Math.round(r.ms/60000)+" MENIT","#fcd34d");
  bpItemPopClose();renderShell();renderBackpackPanel();
}
function bpUseMythicPotion(){
  const n=bpMultiN;let done=0,switches=0,kept=0,best=null,last=null;
  for(let i=0;i<n;i++){
    const r=useMythicWeatherPotion();
    if(!r.ok)break;
    done++;last=r.weather;
    if(r.kept)kept++;else{switches++;if(!best||r.weather.dropWeight<best.dropWeight)best=r.weather;}
  }
  if(!done){
    toast("Potion habis","GAK ADA POTION","#f87171");
    return;
  }
  if(n>1){
    const w=best||last;
    toast(`${w?w.icon+' '+w.name:'GACHA ×'+done}`,`×${done} ROLL · ${switches} PINDAH · ${kept} SKIP`,w?w.color:'#5eead4');
    if(switches)beep(520,.16,"triangle",.1),setTimeout(()=>beep(880,.2,"triangle",.1),120);
    else beep(240,.18,"sine",.07);
  }else if(last&&best===null&&kept){
    toast(`${last.icon} ${last.name}`,"ROLL LEBIH JELEK · CUACA TETEP",last.color);
    beep(240,.18,"sine",.07);
  }else{
    beep(520,.16,"triangle",.1);setTimeout(()=>beep(880,.2,"triangle",.1),120);
    toast(`${best.icon} ${best.name}`,"WEATHER AKTIF · AWAKENED 3%",best.color);
  }
  renderShell();renderBackpackPanel();bpItemPop('mythic');
}
/* Pakai INTAN ROLL 100K: tarik 100.000 roll sekaligus, lalu tampilkan ringkasan loot. */
function bpUseIntanRoll(){
  if((state.intanRolls||0)<1){toast("INTAN ROLL habis","GAK ADA ITEM","#f87171");return;}
  state.intanRolls--;save();
  bpItemPopClose();
  beep(440,.18,"triangle",.1);setTimeout(()=>beep(880,.24,"triangle",.08),150);
  const loot=instantRollFast(100000);
  showTowerLoot(loot,{weather:0,luck:0,speed:0},"HASIL INTAN ROLL · 100K");
  renderBackpackPanel();
}
/* ====== TAB TREE: pohon skill. Root di tengah, dua cabang menjalar (LUCK kiri | SPEED kanan).
   SP didapet tiap naik LV; node butuh node sebelumnya di cabang yang sama. ====== */
/* Kanvas base px; zoom dikunci 100% — navigasi via drag-pan. */
const ST_W=940,ST_H=740;
const stZoom=1;
/* Apply zoom langsung tanpa re-render panel (dipakai wheel & tombol). */
function stApplyZoom(){
  const scale=document.querySelector('.st-scale');if(!scale)return;
  const canvas=scale.firstElementChild;
  canvas.style.width=ST_W+'px';canvas.style.height=ST_H+'px';
  scale.style.width=(ST_W*stZoom)+'px';scale.style.height=(ST_H*stZoom)+'px';
  canvas.style.transform='scale('+stZoom+')';
  const lbl=document.querySelector('.st-zoom-lbl');if(lbl)lbl.textContent=Math.round(stZoom*100)+'%';
  stSyncLanes();
}
/* Sinkron frame lane ke kolom hex: posisi/ukuran ikut isi (px), styling gak pernah di-scale. */
function stSyncLanes(){
  const wrap=document.querySelector('.st-wrap');if(!wrap)return;
  const view=wrap.querySelector('.st-view'),canvas=wrap.querySelector('.st-canvas');
  const laneL=wrap.querySelector('.st-lane.luck'),laneS=wrap.querySelector('.st-lane.speed');
  if(!view||!canvas||!laneL||!laneS)return;
  const wr=wrap.getBoundingClientRect(),cr=canvas.getBoundingClientRect();
  const z=stZoom||1;
  const colW=108*z; /* node 84 + padding 24 */
  const x1=cr.left+0.24*cr.width, x2=cr.left+0.76*cr.width;
  const rawT=cr.top-wr.top+0.15*cr.height-48*z-16*z; /* y15% - setengah node - napas */
  const rawB=cr.top-wr.top+0.85*cr.height+48*z+16*z;
  const t=Math.max(16,rawT), b=Math.min(wr.height-12,rawB);
  const set=(el,cx)=>{
    el.style.left=(cx-colW/2-wr.left)+'px';
    el.style.right='auto';
    el.style.width=colW+'px';
    el.style.top=t+'px';
    el.style.bottom='auto';
    el.style.height=Math.max(40,b-t)+'px';
  };
  set(laneL,x1);set(laneS,x2);
}
/* Tinggi view dipatok ke sisa ruang .bp-body.tree — frame gak pernah nembus panel, bawah tree gak kepotong. */
function stFitViewH(){
  const view=document.querySelector('.st-view');if(!view)return;
  const body=view.closest('.bp-body');if(!body)return;
  const top=view.getBoundingClientRect().top-body.getBoundingClientRect().top+body.scrollTop;
  view.style.height=Math.max(300,body.clientHeight-top-16)+'px';
}
/* Pasang setelah innerHTML: fit tinggi view + drag-pan (zoom dikunci 100%). */
function stMount(){
  const view=document.querySelector('.st-view');if(!view)return;
  stFitViewH();
  stApplyZoom();
  /* frame lane ikut ngikuti kolom pas drag-pan */
  view.addEventListener('scroll',()=>stSyncLanes(),{passive:true});
  /* drag-to-pan: mouse & touch (node hex tetap bisa diklik). */
  let sx=0,sy=0,sl=0,st=0,drag=false;
  view.addEventListener('pointerdown',e=>{if(e.target.closest('.st-node'))return;drag=true;sx=e.clientX;sy=e.clientY;sl=view.scrollLeft;st=view.scrollTop;view.setPointerCapture(e.pointerId);view.classList.add('grabbing');});
  view.addEventListener('pointermove',e=>{if(!drag)return;view.scrollLeft=sl-(e.clientX-sx);view.scrollTop=st-(e.clientY-sy);});
  view.addEventListener('pointerup',()=>{drag=false;view.classList.remove('grabbing');});
  view.addEventListener('pointercancel',()=>{drag=false;view.classList.remove('grabbing');});
  /* resize window: patokin lagi tinggi view + sync lane (sekali daftar aja) */
  if(!stMount._rs){stMount._rs=true;window.addEventListener('resize',()=>{stFitViewH();stApplyZoom();});}
}
/* Posisi hexagon (persen kanvas): root di tengah, LUCK kolom kiri, SPEED kolom kanan. */
const ST_POS={root:[50,50]};
["lk1","lk2","lk3","lk4","lk5"].forEach((id,i)=>ST_POS[id]=[24,15+17.5*i]);
["sp1","sp2","sp3","sp4","sp5"].forEach((id,i)=>ST_POS[id]=[76,15+17.5*i]);
function stNodeHtml(n,sp){
  const isRoot=n.branch==='root';
  const owned=isRoot||treeOwned(n.id);
  const preqMet=n.req.every(r=>r==="root"||treeOwned(r));
  const affordable=sp>=n.cost;
  const st=owned?'owned':(preqMet&&affordable?'avail':(preqMet?'poor':'locked'));
  const gain=isRoot?'AKAR':(n.branch==='luck'?('+'+(Number.isInteger(n.luck)?n.luck:n.luck.toFixed(1))+' LUCK'+(n.luckPct?' · +'+Math.round(n.luckPct*100)+'%':'')):('+'+n.speed.toFixed(1)+'× SPEED'));
  const ic=BP_NODE_ICONS[n.name]||'◆';
  const [x,y]=ST_POS[n.id]||[50,50];
  const cost=isRoot?'':`<div class="st-cost">${owned?'✓':n.cost+' SP'}</div>`;
  return `<div class="st-node st-${n.branch} st-${st}" ${isRoot?'':'onclick="bpTreeBuy(\''+n.id+'\')"'} style="left:${x}%;top:${y}%" title="${n.name} — ${gain} · ${n.desc}">
    <div class="st-in"><div class="st-ico">${ic}</div><div class="st-name">${n.name}</div><div class="st-gain">${gain}</div>${cost}</div>
  </div>`;
}
const BP_NODE_ICONS={"FONDASI":"◆","PEKA":"◉","TERLIHAT":"◎","MENTARI":"☀","BERTUAH":"☆","MUARA REZEKI":"☘","RINGAN":"⇢","CEPAT":"➤","PETIR":"⚡","KILAT":"≫","CAHAYA":"✦"};
/* Garis energi antar hex (SVG): root→cabang selalu mengalir; segmen lain ikut state node sumbernya. */
function stLinesHtml(sp){
  const seg=(a,b,br)=>{
    const A=ST_POS[a],B=ST_POS[b];
    let cls='flow';
    const src=TREE_NODES.find(nn=>nn.id===a);
    if(a!=='root'&&src){
      const owned=treeOwned(src.id);
      const preqMet=src.req.every(r=>r==="root"||treeOwned(r));
      const affordable=sp>=src.cost;
      cls=owned?'flow':(preqMet&&affordable?'pulse':'dead');
    }
    return `<line class="ln ln-${br} ${cls}" x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}"/>`;
  };
  const lk=["lk1","lk2","lk3","lk4","lk5"],spd=["sp1","sp2","sp3","sp4","sp5"];
  let out=seg("root",lk[0],"luck")+seg("root",spd[0],"speed");
  for(let i=1;i<lk.length;i++)out+=seg(lk[i-1],lk[i],"luck");
  for(let i=1;i<spd.length;i++)out+=seg(spd[i-1],spd[i],"speed");
  return `<svg class="st-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${out}</svg>`;
}
function renderBpTree(){
  const sp=(state&&state.player&&state.player.sp)||0;
  const goal=TREE_NODES.filter(n=>n.id!=='root'&&!treeOwned(n.id)&&n.req.every(r=>r==='root'||treeOwned(r))).sort((a,b)=>a.cost-b.cost)[0];
  const pct=goal?Math.min(100,Math.round(sp/goal.cost*100)):100;
  const ready=!!goal&&sp>=goal.cost;
  const hint=sp>0?'ketuk hexagon buat naikkin':'naikkin LV buat dapet SP';
  const goalTxt=goal?(goal.name+' · '+goal.cost+' SP'+(ready?' — SIAP!':'')):'SEMUA NODE TERBUKA';
  return `<div class="spbar">
    <div class="sp-banner">
      <div class="sp-crystal"></div>
      <div class="sp-meta">
        <div class="sp-label">SKILL POINT <span class="sp-goal${ready?' ready':''}">${goalTxt}</span></div>
        <div class="sp-track"><div class="sp-fill${ready?' full':''}" style="width:${pct}%"></div></div>
      </div>
      <div class="sp-num">${sp}</div>
    </div>
    <div class="sp-hint">${hint}</div>
  </div>
  <div class="st-pills">
    <span class="st-pill luck">☘ LUCK <b>${totalLuck().toFixed(1)}×</b></span>
    <span class="st-pill speed">⚡ SPEED <b>${playerSpeedMult().toFixed(1)}×</b> · CAP 5×</span>
  </div>
  <div class="st-wrap"><div class="st-view"><div class="st-scale"><div class="st-canvas">${stLinesHtml(sp)}${TREE_NODES.map(n=>stNodeHtml(n,sp)).join('')}</div></div></div><div class="st-lane luck"><span class="st-lane-hd">☘ LUCK</span></div><div class="st-lane speed"><span class="st-lane-hd">⚡ SPEED</span></div></div>`;
}
function bpTreeBuy(id){
  const r=treeBuy(id);
  if(!r.ok){
    const msg=r.reason==='SP'?'SP kurang':r.reason==='PREQ'?'Buka node sebelumnya dulu':r.reason==='OWNED'?'Udah dibuka':'-';
    beep(200,.08,'square',.06);toast(msg,'GAK BISA','#f87171');return;
  }
  beep(680,.12,'triangle',.09);setTimeout(()=>beep(900,.12,'triangle',.08),90);
  const g=r.node.branch==='luck'?(r.node.luck.toFixed(1)+' LUCK'):(r.node.speed.toFixed(1)+'× SPEED');
  toast(r.node.name,'+'+g,r.node.branch==='luck'?'#5eead4':'#fcd34d');
  renderShell();renderBackpackPanel();
}


/* ====== TAB ARTEFAK & PET (backpack): grid beli + slot equip. Passive = LUCK semua. ====== */
function artIconSvg(k){
  const S=p=>`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  if(k==="manik")return S(`<circle cx="24" cy="12.5" r="5" stroke-width="2"/><circle cx="35.5" cy="24" r="5" stroke-width="2"/><circle cx="24" cy="35.5" r="5" stroke-width="2"/><circle cx="12.5" cy="24" r="5" stroke-width="2"/><circle cx="24" cy="24" r="4.5" stroke-width="1.6" fill="currentColor" fill-opacity=".55"/>`);
  if(k==="medal")return S(`<path d="M16 6l5.5 14M32 6l-5.5 14" stroke-width="2.4"/><circle cx="24" cy="31" r="10.5" stroke-width="2.4"/><path d="M24 25.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="currentColor" stroke="none"/>`);
  if(k==="giok")return S(`<ellipse cx="24" cy="24" rx="11.5" ry="14.5" stroke-width="2.4"/><path d="M17.5 18c4 2.6 9 2.6 13 0M16.5 30c4.5-2.6 10.5-2.6 15 0" stroke-width="1.5" stroke-opacity=".75"/>`);
  if(k==="batu")return S(`<path d="M24 7.5l13.5 9.5-5 18.5H15.5l-5-18.5z" stroke-width="2.4"/><path d="M10.5 17h27M24 7.5l-3.5 9.5 3.5 18.5 3.5-18.5L24 7.5" stroke-width="1.4" stroke-opacity=".75"/>`);
  if(k==="cincin")return S(`<circle cx="24" cy="30" r="10.5" stroke-width="2.4"/><path d="M24 6l5.5 7.5L24 21l-5.5-7.5z" stroke-width="2"/><path d="M24 6v15M18.5 13.5h11" stroke-width="1.3" stroke-opacity=".8"/>`);
  return S(`<path d="M14 9.5h20l7.5 10.5L24 41 6.5 20z" stroke-width="2.4"/><path d="M6.5 20h35M14 9.5L18 20l6 21 6-21 4-10.5" stroke-width="1.5" stroke-opacity=".8"/>`);
}
/* Ikon artefak CRAYON: PNG saja — tanpa SVG di belakang (berlian default gak nongol). */
function artIconHtml(d){
  if(!d.img)return artIconSvg(d.icon);
  return `<span class="icov"><img src="${d.img}" alt="" onerror="this.remove()"></span>`;
}
/* Tombol beli Backpack per kanal: raid/tower TIDAK dijual pakai coin — tombol jadi petunjuk sumber. */
function bpBuyBtn(d,kind){
  if(d.src==="raid")return `<button class="bp-shop-b off" onclick="toast('TOKO RAID','BELI PAKAI TOKEN RAID · ${fmt(d.raidCost||0)} TOKEN','#B58CFF')">TOKO RAID · ${fmt(d.raidCost||0)} TOKEN</button>`;
  if(d.src==="tower")return `<button class="bp-shop-b off" onclick="toast('INF TOWER','DROP BASE CHANCE — TIDAK KENA LUCK PLAYER','#7DF9FF')">DROP · INF TOWER</button>`;
  return `<button class="bp-shop-b ${(state.coins||0)>=d.price?'buy':'poor'}" onclick="bpBuy${kind}('${d.id}')">BELI · 🪙 ${fmt(d.price)}</button>`;
}
function renderBpArts(){
  const coins=state.coins||0;
  const slots=[0,1].map(i=>{
    const id=state.artSlots[i],d=id?ART_DEFS.find(x=>x.id===id):null;
    if(!d)return `<div class="bp-aslot empty" onclick="toast('SLOT KOSONG','BELI ARTEFAK DULU','#fcd34d')"><span>◈</span></div>`;
    return `<div class="bp-aslot filled" style="--ec:${d.color}" onclick="bpArtSlot(${i})">${artIconHtml(d)}<span class="bp-aslot-n">${d.name}</span><button class="bp-aslot-x" onclick="event.stopPropagation();bpArtSlot(${i})">&times;</button></div>`;
  }).join('');
  const cards=ART_DEFS.map(d=>{
    const owned=state.artOwned.includes(d.id),eq=state.artSlots.includes(d.id);
    const btn=eq?`<button class="bp-shop-b off" onclick="bpToggleArt('${d.id}')">LEPAS</button>`
      :owned?`<button class="bp-shop-b on" onclick="bpToggleArt('${d.id}')">PASANG</button>`
      :bpBuyBtn(d,"Art");
    return `<div class="bp-shop${eq?' eq':''}" style="--ec:${d.color}"><div class="bp-shop-ic">${artIconHtml(d)}</div><div class="bp-shop-n">${d.name}</div><div class="bp-shop-e">${luckTxt(d)}</div>${btn}</div>`;
  }).join('');
  return `<div class="bp-h">ARTEFAK · 2 SLOT<div class="bp-coinrow">☘ ${totalLuck().toFixed(1)}× · 🪙 ${fmt(coins)}</div></div>
  <div class="bp-slotsrow">${slots}<div class="bp-aslot-hint">Klik slot untuk lepas<br>Beli artefak dulu untuk pasang</div></div>
  <div class="bp-grid6">${cards}</div>`;
}
function renderBpPets(){
  const coins=state.coins||0;
  const act=state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;
  const actHtml=act?`<div class="bp-petact">
    <div class="bp-petact-img"><img src="${act.img}" alt="${act.name}" onerror="this.parentNode.classList.add('noimg')"><span class="lp-fb">${act.emoji}</span></div>
    <div class="bp-petact-meta"><span class="bp-petact-l">PET AKTIF</span><span class="bp-petact-n">${act.name}</span><span class="bp-petact-e">${luckTxt(act)}</span></div>
    <button class="bp-shop-b off" style="margin-left:auto" onclick="bpTogglePet('${act.id}')">LEPAS</button></div>`
    :`<div class="bp-petact"><span class="bp-petact-none">BELUM ADA PET AKTIF — BELI &amp; PASANG DI BAWAH</span></div>`;
  const cards=PET_DEFS.map(p=>{
    const owned=state.petOwned.includes(p.id),eq=state.petEquipped===p.id;
    const btn=eq?`<button class="bp-shop-b off" onclick="bpTogglePet('${p.id}')">LEPAS</button>`
      :owned?`<button class="bp-shop-b on" onclick="bpTogglePet('${p.id}')">PASANG</button>`
      :bpBuyBtn(p,"Pet");
    return `<div class="bp-shop${eq?' eq':''}" style="--ec:#7DF9FF"><div class="bp-shop-ic"><img src="${p.img}" alt="${p.name}" onerror="this.parentNode.classList.add('noimg')"><span class="ph">${p.emoji}</span></div><div class="bp-shop-n">${p.name}</div><div class="bp-shop-e">${luckTxt(p)}</div>${btn}</div>`;
  }).join('');
  return `<div class="bp-h">PET · 1 SLOT<div class="bp-coinrow">☘ ${totalLuck().toFixed(1)}× · 🪙 ${fmt(coins)}</div></div>
  ${actHtml}
  <div class="bp-grid6">${cards}</div>`;
}

function bpBuyArt(id){
  const d=ART_DEFS.find(x=>x.id===id);if(!d||state.artOwned.includes(id))return;
  if(d.src&&d.src!=="coin"){toast("TIDAK DIJUAL DI SINI",d.src==="raid"?"BELI DI TOKO RAID PAKAI TOKEN":"DROP BASE DI INF TOWER","#fcd34d");return;}
  if((state.coins||0)<d.price){beep(200,.09,"square",.06);toast("COIN KURANG","BUTUH 🪙 "+fmt(d.price),"#f87171");return;}
  state.coins-=d.price;state.artOwned.push(id);save();
  beep(680,.12,"triangle",.09);setTimeout(()=>beep(900,.12,"triangle",.08),90);
  toast(d.name,luckTxt(d),d.color);renderShell();renderBackpackPanel();
}
function bpToggleArt(id){
  const d=ART_DEFS.find(x=>x.id===id);if(!d||!state.artOwned.includes(id))return;
  const i=state.artSlots.indexOf(id);
  if(i>=0){state.artSlots[i]=null;beep(360,.08,"triangle",.06);toast("DILEPAS",d.name,"#9ca3af");}
  else{let s=state.artSlots.indexOf(null);if(s<0)s=0;state.artSlots[s]=id;beep(680,.12,"triangle",.09);toast("TERPASANG",d.name+" → SLOT "+(s+1),d.color);}
  save();renderShell();renderBackpackPanel();
}
function bpArtSlot(i){const id=state.artSlots[i];if(id)bpToggleArt(id);}
function bpBuyPet(id){
  const d=PET_DEFS.find(x=>x.id===id);if(!d||state.petOwned.includes(id))return;
  if(d.src&&d.src!=="coin"){toast("TIDAK DIJUAL DI SINI",d.src==="raid"?"BELI DI TOKO RAID PAKAI TOKEN":"DROP BASE DI INF TOWER","#fcd34d");return;}
  if((state.coins||0)<d.price){beep(200,.09,"square",.06);toast("COIN KURANG","BUTUH 🪙 "+fmt(d.price),"#f87171");return;}
  state.coins-=d.price;state.petOwned.push(id);save();
  beep(680,.12,"triangle",.09);setTimeout(()=>beep(900,.12,"triangle",.08),90);
  toast(d.name,luckTxt(d),"#7DF9FF");renderShell();renderBackpackPanel();
}
function bpTogglePet(id){
  const d=PET_DEFS.find(x=>x.id===id);if(!d||!state.petOwned.includes(id))return;
  if(state.petEquipped===id){state.petEquipped=null;beep(360,.08,"triangle",.06);toast("PET DILEPAS",d.name,"#9ca3af");}
  else{state.petEquipped=id;beep(680,.12,"triangle",.09);toast("PET AKTIF",d.name+" · "+luckTxt(d),d.color);}
  save();renderShell();renderBackpackPanel();
  if(!state.battle&&typeof render==="function")render();
}
function lobbyPetHtml(){
  const d=state&&state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;
  if(!d)return"";
  return `<div class="lobby-pet"><img src="${d.img}" alt="${d.name}" onerror="this.parentNode.classList.add('noimg')"><span class="lp-eb">${d.emoji}</span><span class="lp-tip"><b style="color:${d.color}">${d.name}</b><small>${luckTxt(d)}</small></span></div>`;
}
/* ===== DEV: buka SEMUA pet + artefak untuk akun aktif (idempoten - aman dijalankan berulang) ===== */
function devUnlockAll(){
  if(!state)return;
  const hadA=(state.artOwned||[]).length, hadP=(state.petOwned||[]).length;
  state.artOwned=ART_DEFS.map(a=>a.id);
  state.petOwned=PET_DEFS.map(p=>p.id);
  if(!Array.isArray(state.artSlots)||state.artSlots.length!==2)state.artSlots=[null,null];
  /* isi slot artefak yang masih kosong - pilihan lama dipertahankan */
  const top=["pedang-api","helm-abyss"];
  for(let i=0;i<2;i++)if(!state.artSlots[i]){const pick=top.find(id=>!state.artSlots.includes(id));if(pick)state.artSlots[i]=pick;}
  if(!state.petEquipped)state.petEquipped="kyubi";
  save();
  beep(680,.12,"triangle",.09);setTimeout(()=>beep(900,.12,"triangle",.08),90);setTimeout(()=>beep(1180,.16,"triangle",.08),190);
  toast("UNLOCK ALL",`+${state.artOwned.length-hadA} artefak + ${state.petOwned.length-hadP} pet - koleksi penuh!`,"#7DF9FF");
  renderShell();
  if(typeof renderBackpackPanel==="function")renderBackpackPanel();
  if(document.getElementById("profBody"))renderProfile();
}
window.devUnlockAll=devUnlockAll;

/* ====== Hover reveal kartu (isi = hubCardHtml, sama persis kartu lobby). Dipakai dek + weather corner. ====== */
let __bpsHoverEl=null;
function hoverPlace(eq,slotRect){
  if(!__bpsHoverEl){__bpsHoverEl=document.createElement('div');__bpsHoverEl.className='bps-hover';document.body.appendChild(__bpsHoverEl);}
  __bpsHoverEl.innerHTML=hubCardHtml(eq);
  __bpsHoverEl.classList.add('show');
  const W=190,H=253,gap=10,vw=window.innerWidth,vh=window.innerHeight;
  let left=slotRect.right+gap;
  if(left+W>vw-8) left=slotRect.left-W-gap;
  if(left<8) left=8;
  let top=slotRect.top;
  if(top+H>vh-8) top=vh-8-H;
  if(top<8) top=8;
  __bpsHoverEl.style.left=left+'px';
  __bpsHoverEl.style.top=top+'px';
}
function bpsHoverShow(sid,slotRect){
  const s=state.stacks.find(x=>x.id===sid);if(!s||!CARDS[s.char])return;
  hoverPlace(s,slotRect);
}
function hoverHide(){if(__bpsHoverEl)__bpsHoverEl.classList.remove('show');}
function bpsHoverHide(){hoverHide();}
/* Hover reveal kartu weather corner -> pakai hoverPlace/hoverHide yang sama kayak dek. */
function wcHoverBind(){
  if(window.__wcBound)return;window.__wcBound=true;
  const SEL='.wc-slot[data-wc]';
  document.addEventListener('mouseover',e=>{
    const sl=e.target.closest&&e.target.closest(SEL);if(!sl)return;
    const id=sl.getAttribute('data-wc');if(!CARDS[id])return;
    hoverPlace({char:id,mut:'none',trait:'none',shiny:false},sl.getBoundingClientRect());
  });
  document.addEventListener('mouseout',e=>{
    const sl=e.target.closest&&e.target.closest(SEL);if(!sl)return;
    const to=e.relatedTarget;
    if(to&&to.closest&&to.closest(SEL)===sl)return;
    hoverHide();
  });
}
function bpsHoverBind(){
  if(window.__bpsBound)return;window.__bpsBound=true;
  const SEL='.bp-slot.filled[data-sid],.bp-tile[data-sid]';
  document.addEventListener('mouseover',e=>{
    const sl=e.target.closest&&e.target.closest(SEL);
    if(sl)bpsHoverShow(sl.getAttribute('data-sid'),sl.getBoundingClientRect());
  });
  document.addEventListener('mouseout',e=>{
    const sl=e.target.closest&&e.target.closest(SEL);
    if(!sl)return;
    const to=e.relatedTarget;
    if(to&&to.closest&&to.closest(SEL)===sl)return;
    bpsHoverHide();
  });
}

/* Level dinomeri global per bab, tiap bab 6 level: Bab 1 = 1-6, Bab 2 = 7-12, Bab 3 = 13-18 */
let _chapAcc=0;
STORY_BIBLE.chapters.forEach(c=>{c.from=_chapAcc+1;_chapAcc+=c.levels.length;c.to=_chapAcc;});
STORY_BIBLE.levels=STORY_BIBLE.chapters.flatMap(c=>c.levels.map(l=>({...l,ch:c.no})));
const CHAPTERS=STORY_BIBLE.chapters;
const chapOf=lv=>CHAPTERS.find(c=>lv>=c.from&&lv<=c.to)||CHAPTERS[0];
const chapCleared=c=>c.levels.filter((_,i)=>state.cleared[c.from+i]).length;
/* chapDone versi lama sudah dihapus karena konflik dengan versi baru (diff-aware) */
const chapOpen=c=>c.no===1||chapDone(CHAPTERS[c.no-2]);
function activeChap(){
  const open=CHAPTERS.filter(chapOpen);
  return open.find(x=>x.no===(state?state.chap:1))||open.find(x=>!chapDone(x))||open[open.length-1]||CHAPTERS[0];
}
const LEVEL_COUNT=STORY_BIBLE.levels.length;
const MASTER_CARD_INDEX=STORY_BIBLE.units.map(u=>({char_id:u.id,name:u.name,tier:u.tier,chance:u.chance||null,type:u.type,base_hp:u.hp,base_atk:u.atk,sprite_asset:u.art,art_image:u.art,pos:u.pos||null,passive:{name:u.skill,desc:u.desc},noGacha:!!u.noGacha,weatherOnly:u.weatherOnly||null,raidBoss:!!u.raidBoss}));
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
       EKSTENSI: double OBJEK {chance,pct} -> hit tambahan x(pct/100) (angka lama tetap). everyNth.next/next all -> hit ke-N ikut flat next% ATK. dodgeAtk.nextOnly -> dodge kasih +pct% damage SATU serangan berikutnya (dodgeNext[]). revive.atkPct -> bangkit +atkPct% ATK. copy:{turns:N} -> ability lawan disalin N giliran (copyLeft tick tiap enemyPhase; resolveFx di-gate). gluttony.healPct / gluttony.noCopy. lowHpAura tanpa burn = aman (guard).
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

/* =============== STATE =============== */
let KEY="aab-state-v2";
const USERS_KEY="aab-users", SESSION_KEY="aab-session";
function hashPass(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h)^s.charCodeAt(i);return (h>>>0).toString(36);}
function getUsers(){try{return JSON.parse(localStorage.getItem(USERS_KEY))||{};}catch(e){return {};}}
function saveUsers(u){localStorage.setItem(USERS_KEY,JSON.stringify(u));}
function freshState(){
  const s0=STORY_BIBLE.units[0];
  const start=s0?{id:Math.random().toString(36).slice(2,9),char:s0.id,tier:s0.tier,fav:false,lock:false,mut:"none",shiny:false,trait:"none",count:1}:null;
  const newState={coins:1000,raidTokens:0,playerLv:1,xp:0,dailyIndex:0,lastClaim:"",summons:0,muted:false,diff:"normal",chap:1,raidDiff:"normal",raidCleared:{normal:false,hard:false,extreme:false,nightmare:false},raidShopOwned:{},tower:{best:0,auto:false},battleSpeed:1,
    cleared:{},clearedDiff:{normal:{},hard:{},extreme:{},nightmare:{}},equippedId:start?start.id:null,equippedId2:null,deck:[start?start.id:null,null,null,null],stacks:start?[start]:[],history:[],battle:null,
    player:{luckBase:1,luckFlat:0,luckPercent:0,exp:0,lv:1,sp:0,tree:{}},weather:null,weatherBest:null,potions:0,mythicPotions:0,luckPots:[0,0,0],speedPots:[0,0,0],luckBuffs:[],speedBuffs:[],infTokens:0,
    artOwned:[],artSlots:[null,null],petOwned:[],petEquipped:null,intanRolls:0,idxRewardsClaimed:0};
  console.log('[FRESH STATE] Initialized player:',newState.player);
  return newState;
}
function todayStr(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function nextResetMs(){const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate()+1,0,0,0,0)-n;}
function fmtCountdown(ms){const s=Math.max(0,Math.floor(ms/1000));const p=x=>String(x).padStart(2,"0");return p(Math.floor(s/3600))+":"+p(Math.floor(s%3600/60))+":"+p(s%60);}
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
  /* BATTLE SPEED: migrasi save lama + clamp ke unlock level (LV25→2x, LV50→3x, LV100→4x) */
  if(typeof state.battleSpeed!=="number"||state.battleSpeed<1||state.battleSpeed>4||Math.floor(state.battleSpeed)!==state.battleSpeed)state.battleSpeed=1;
  {const _lv=state.playerLv||1,_max=_lv>=100?4:_lv>=50?3:_lv>=25?2:1;if(state.battleSpeed>_max)state.battleSpeed=_max;}
  /* MIGRATE: flag kepemilikan kartu BOSS (TOKO RAID) — unlock roll permanen */
  if(!state.raidShopOwned||typeof state.raidShopOwned!=="object")state.raidShopOwned={};
  console.log('[LOAD STATE] Initial player state:',state.player);
  
  if(!state.stacks||!state.stacks.length){const st=freshState();state.stacks=st.stacks;state.equippedId=st.equippedId;}
  
  state.stacks=state.stacks.filter(s=>CARDS[s.char]);
  
  {const seen={};state.stacks.forEach(s=>{const k=s.char+"|"+(s.mut||"none");if(!seen[k]){seen[k]=s;s.count=s.count||1;}else{seen[k].count=(seen[k].count||1)+(s.count||1);if((s.trait&&s.trait!=="none")&&(!seen[k].trait||seen[k].trait==="none"))seen[k].trait=s.trait;}});state.stacks=Object.values(seen);}
  
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
  if(typeof state.idxRewardsClaimed!=="number"||state.idxRewardsClaimed<0)state.idxRewardsClaimed=0;
  
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
function mutBox(mut,cls){const label=MUT_LABEL[mut];if(!label)return "";return `<span class="${cls}" style="border-color:${MUT_COLOR[mut]};color:${MUT_COLOR[mut]}">${mutBadge(mut)}</span>`;}
const mutGlow=m=>m&&m!=="none"?` mut-${m}`:"";
const mutEdge=m=>m&&m!=="none"?` style="border-color:${MUT_COLOR[m]}"`:"";
function enemyOf(level){const f=FOES[level];if(!f)return{id:null,name:"Gate Watcher L-"+level,epithet:chapOf(level).zone,img:chapOf(level).art,boss:false,tier:"R"};return{id:f.id,name:f.name,epithet:f.ep,img:f.img,boss:!!f.boss,tier:f.tier};}
function enemyStats(level){const l=STORY_BIBLE.levels[level-1];if(!l)return{hp:120,atk:40};const c=CARDS[l.unit];if(!c)return{hp:120,atk:40};const k=MUT_MULT[diffOf().mut]||1;return{hp:Math.round(c.base_hp*(0.55+0.15*level)*k),atk:Math.round(c.base_atk*(0.35+0.13*level)*k)};}
function firstClearReward(level){const l=STORY_BIBLE.levels[level-1];return (l?l.reward:300)*(diffOf().rw||1);}
function save(){if(state)localStorage.setItem(KEY,JSON.stringify(state));}
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
const sfx={hit:()=>beep(180,.07),crit:()=>beep(560,.12,"sawtooth",.06),dodge:()=>beep(760,.06,"sine"),
  win:()=>{[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.14,"triangle",.06),i*110));},
  lose:()=>{[330,262,196].forEach((f,i)=>setTimeout(()=>beep(f,.18,"sine",.06),i*140));},
  pull:()=>beep(880,.2,"sine",.05)};

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
/* Dentuman crit: langsung (tanpa delay), pendek, nendang — di-layer di atas sfx.crit() */
function critBoom(){
  if(state.muted)return;
  try{
    const a=actxOf(),t0=a.currentTime;
    const s=a.createOscillator();s.type="sine";
    s.frequency.setValueAtTime(150,t0);s.frequency.exponentialRampToValueAtTime(38,t0+.28);
    const g=a.createGain();
    g.gain.setValueAtTime(.0001,t0);
    g.gain.exponentialRampToValueAtTime(.5,t0+.02);
    g.gain.exponentialRampToValueAtTime(.0001,t0+.32);
    s.connect(g);g.connect(a.destination);s.start(t0);s.stop(t0+.34);
  }catch(e){}
}
const fightAudio=new Audio("assets/audio/fight.mp3");
fightAudio.preload="auto";
const swordAudio=new Audio("assets/audio/sword.mp3");
swordAudio.preload="auto";
const winAudio=new Audio("assets/audio/win.mp3");
winAudio.preload="auto";
const dodgeAudio=new Audio("assets/audio/dodge.mp3");
dodgeAudio.preload="auto";
const purpleAudio=new Audio("assets/audio/hollow_purple.mp3");
purpleAudio.preload="auto";
const domainAudio=new Audio("assets/audio/domain_void.mp3");
domainAudio.preload="auto";
const punchAudio=new Audio("assets/audio/punch.mp3");
punchAudio.preload="auto";
function playClip(a){
  if(state.muted)return;
  try{const c=a.cloneNode(true);c.play().catch(()=>{});}catch(e){}
}
function playClipDur(a,durMs,fadeMs){
  if(state.muted)return;
  try{
    const c=a.cloneNode(true);const base=c.volume;c.play().catch(()=>{});
    const fade=Math.max(0,(fadeMs!=null?fadeMs:250));
    const stopAt=Math.max(120,durMs-fade);
    setTimeout(()=>{
      let v=base;const step=base*30/Math.max(1,fade);
      const t=setInterval(()=>{v-=step;c.volume=Math.max(0,v);if(v<=0){clearInterval(t);try{c.pause();}catch(_){}}},30);
    },stopAt);
    setTimeout(()=>{try{c.pause();}catch(_){}},durMs+40);
  }catch(e){}
}
function fanfare(){playClip(winAudio);}
function playDodge(){playClip(dodgeAudio);}
/* satu klip suara pedang per ayunan; pakai clone supaya multi-hit bisa tumpang tindih */
function swing(){
  if(state.muted)return;
  try{
    const a=swordAudio.cloneNode(true);
    a.play().catch(()=>{});
    setTimeout(()=>{
      let v=1;const t=setInterval(()=>{v-=.2;a.volume=Math.max(0,v);if(v<=0){clearInterval(t);a.pause();}},40);
    },430);
  }catch(e){}
}
function fightShout(){
  impactBoom();
  if(state.muted)return;
  try{fightAudio.currentTime=0;fightAudio.play().catch(()=>{});}catch(e){}
}
/* ---------- suara serangan Gojo: Hollow Purple (charge → boom tebal + crackle) ---------- */
/* =============== SHELL RENDER =============== */
const app=document.getElementById("app");
const ROUTES={"#/lobby":"LOBBY","#/":"STORY","#/raid":"BOSS RAID","#/tower":"INFINITE TOWER","#/settings":"PENGATURAN"};
function route(){const h=location.hash;return ROUTES[h]?h:"#/lobby";}
// Button profil footer = MUKA kartu utama (deck slot 1), di-crop ke muka pakai .pos kartu.
function renderFootProfile(){
  const b=document.getElementById('footAv'); if(!b) return;
  const eq=equipped(); const cid=eq&&eq.char;
  const art=(cid&&CARDS[cid])?cardImg(cid):"";
  if(art){
    const pos=CARDS[cid].pos?` style="object-position:${CARDS[cid].pos}"`:'';
    b.innerHTML=`<img src="${art}" alt="${cardName(cid)}" title="${cardName(cid)}"${pos}>`;
    b.classList.add('has-art');
  }else{
    b.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6.5 8-6.5S20 16 20 20"/></svg>';
    b.classList.remove('has-art');
  }
}
function renderShell(){
  document.getElementById("coinVal").textContent=fmt(state.coins);
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
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.route===route()));
  try{const pm=document.getElementById("profModal");if(pm&&pm.style.display!=="none"&&pm.style.display!=="")renderProfile();}catch(e){}
  try{renderWeatherDock();renderBuffDock();startWeatherTick();}catch(e){}
  try{renderFootProfile();}catch(e){}
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
      <div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><ellipse cx="12" cy="6.5" rx="8" ry="3.3"/><path d="M4 6.5v5c0 1.8 3.6 3.3 8 3.3s8-1.5 8-3.3v-5"/><path d="M4 11.5v5c0 1.8 3.6 3.3 8 3.3s8-1.5 8-3.3v-5"/></svg></div>
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
let _dailyLast=null;
setInterval(()=>{
  if(!state)return;
  tickDaily();
  if(state.lastClaim===_dailyLast)return;
  _dailyLast=state.lastClaim;renderShell();
  if(document.getElementById("dailyModal").classList.contains("show"))renderDaily();
},1000);

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
      <img src="${c.art}" alt="">
      <div class="shade"></div>
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
function openStory(){
  const mm=document.getElementById("missionModal");if(mm)mm.classList.remove("show");
  const ch=activeChap(),pw=totalPower();
  if(!cellUnlocked(ch,state.diff)){state.diff=highestChapDiff(ch);save();}
  document.getElementById("smKicker").textContent="CERITA · "+ch.tag.split("·")[1].trim();
  document.getElementById("smTitle").textContent=ch.zone;
  /* HERO: art bab + info gate — nyambung visual sama banner lobby (shade + sb-line) */
  const df=diffOf(),dcol=MUT_COLOR[df.mut]||"var(--cyan)";
  let nx=ch.to;const cdh=diffProg()[state.diff];
  for(let i=ch.from;i<=ch.to;i++){if(!cdh[i]){nx=i;break;}}
  const gnx=gateOf(nx),doneN=chapProgMode(ch,state.diff),okN=pw>=gnx;
  document.getElementById("smHero").innerHTML=
    `<img src="${ch.art}" alt="" onerror="this.remove()"><div class="shade"></div>`+
    `<span class="smh-chip" style="border-color:${dcol};color:${dcol}">${df.l}</span>`+
    `<div class="smh-line">GATE ${fmt(gnx)} · POWER ${fmt(pw)} <b class="${okN?"ok":"bad"}">${okN?"SIAP":"KURANG"}</b> · PROGRES ${doneN}/${ch.levels.length}</div>`;
  document.getElementById("smDiff").innerHTML=DIFFS.map(d=>{const unl=cellUnlocked(ch,d.k),on=d.k===state.diff,col=d.mut==="none"?"var(--pink)":MUT_COLOR[d.mut];return `<button class="diff-btn${on?" on":""}${unl?"":" locked"}" data-d="${d.k}"${on?` style="border-color:${col};color:${col}"`:""}>${unl?d.l:"&#128274; "+d.l}</button>`;}).join("");
  document.getElementById("smDiffNote").textContent="";
  document.querySelectorAll("#smDiff .diff-btn").forEach(b=>b.onclick=()=>{
    const k=b.dataset.d;const note=document.getElementById("smDiffNote");
    if(!cellUnlocked(ch,k)){note.textContent=cellReqText(ch,k);sfx.lose&&sfx.lose();return;}
    if(state.diff===k){note.textContent="";return;}
    note.textContent="";state.diff=k;sfx.hit();save();openStory();
  });
  document.getElementById("levels").innerHTML=Array.from({length:ch.levels.length},(_,i)=>{
    const cellOpen=cellUnlocked(ch,state.diff);const cd=diffProg()[state.diff];const lv=ch.from+i,en=enemyOf(lv),cl=cd[lv],unlocked=cellOpen&&(i===0||cd[lv-1]),g=gateOf(lv),ok=pw>=g;
    return `<button class="lvl-btn${unlocked?"":" locked"}${en.boss?" boss":""}${unlocked&&!ok?" weak":""}" data-lv="${lv}" title="${en.name} · GATE ${fmt(g)}" ${unlocked?"":"disabled"}>
      <img class="lvl-art" src="${en.img}" alt="" loading="lazy" onerror="this.remove()">
      ${cl?'<span class="chk">✓</span>':""}
      ${unlocked?`<span class="lvl-num">${i+1}</span>${en.boss?'<span class="lvl-bos">BOS</span>':""}<span class="lvl-name">${en.name}</span>`:'<span class="lvl-lock">🔒</span>'}
    </button>`;}).join("");
  document.querySelectorAll("#levels .lvl-btn:not(.locked)").forEach(x=>x.onclick=()=>openStart(+x.dataset.lv));
  document.getElementById("storyModal").classList.add("show");
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
function playFight(cb){
  const f=document.getElementById("fightFx");
  f.classList.remove("go");void f.offsetWidth;f.classList.add("go");
  if(!state.muted)try{noiseBurst(actxOf().currentTime,.22,1500,.05);}catch(e){}
  fightShout();
  clearTimeout(fightTimer);
  fightTimer=setTimeout(()=>{f.classList.remove("go");cb();},1280);
}

/* =============== BATTLE =============== */
let bt=null;
/* ===== BATTLE SPEED: multiplier pacing seluruh engine battle (cerita + Infinite Tower).
   Semua jeda dijadwalkan lewat schedPhase()/bsMs(ms) → dibagi bt.speed. bt.speed dibekukan per battle
   dari battleSpeedEff() (state.battleSpeed; terkunci level: LV25→2x, LV50→3x, LV100→4x).
   Skala linear → urutan antar-timeout di dalam satu fase tetap aman. ===== */
function battleSpeedMax(){const lv=(state&&state.playerLv)||1;return lv>=100?4:lv>=50?3:lv>=25?2:1;}
function battleSpeedEff(){let s=(state&&state.battleSpeed)||1;if(s<1)s=1;const m=battleSpeedMax();return Math.min(Math.floor(s),m);}
function bsMs(ms){const m=(bt&&bt.speed)||1;return m<=1?ms:Math.max(0,Math.round(ms/m));}
/* Tombol speed in-battle (di .vs-col): cycle 1x→2x→3x→4x→1x — hanya tier yang sudah terbuka per level.
   Efek langsung ke bt.speed (timeout berikutnya) + persist state.battleSpeed (ikut ke settings & battle berikut). */
function wireSpeedBtn(){
  const b=document.getElementById("bspeedBtn");
  if(!b)return;
  const upd=()=>{
    const m=battleSpeedMax();
    const sp=battleSpeedEff();
    b.textContent=sp+"×";
    b.disabled=m<=1;
    b.title=m<=1?"Battle speed terbuka di LV 25":("SPEED "+sp+"× · LV "+(state.playerLv||1)+" — tap untuk ganti");
  };
  upd();
  b.onclick=()=>{
    const m=battleSpeedMax();if(m<=1)return;
    const cur=(state.battleSpeed>=1&&state.battleSpeed<=m)?Math.floor(state.battleSpeed):1;
    state.battleSpeed=cur>=m?1:cur+1;
    save();
    if(bt)bt.speed=battleSpeedEff();
    upd();
  };
}
function meFighterHtml(s){
  const st=cardStats(s.char,s.mut,s.trait,s.shiny);
  const mut=(s.mut&&s.mut!=="none")?s.mut:null;
  const trait=(s.trait&&s.trait!=="none")?s.trait:null;
  return `<div class="f-banner"><img src="${cardImg(s.char)}" alt="${cardName(s.char)}"${CARDS[s.char]&&CARDS[s.char].pos?` style="object-position:${CARDS[s.char].pos}"`:''}>${shinyName('div','f-name','f-name-shine',mut,s.shiny,cardName(s.char))}<span class="hc-chance">1 in ${fmt(luckChance(s.char,s.mut,s.shiny))}</span>
    ${(s.shiny||mut||trait)?`<div class="f-badges">${s.shiny?'<span class="shiny-badge">SHINY</span>':''}${mut?mutChip(mut,`<span class="mut-badge" style="border-color:${MUT_COLOR[mut]}">${mutBadge(mut)}</span>`):''}${trait?traitChip(trait,`<span class="hc-trait hc-gem" style="border-color:${TRAIT_COLOR[trait]}">${traitGem(14,trait)}</span>`):''}</div>`:""}
    </div>
    <div class="hpbar"><i id="hpMe"></i><span id="hpMeT">${fmt(st.hp)} / ${fmt(st.hp)}</span></div>
    <div class="f-body">
      <div class="f-title">${cardType(s.char)}</div>
      <div class="f-skill">${passiveName(s.char)}</div>
      <div class="stat-row"><div class="stat">♡ ${fmt(st.hp)}</div><div class="stat">${ATKIC} ${fmt(st.atk)}</div></div>
    </div>`;
}
function meShadowHtml(sh){return `<div class="f-banner"><img src="${sh.img}" alt="${sh.name}" style="filter:grayscale(.35) brightness(.72) hue-rotate(215deg) saturate(1.5)"><div class="f-name" style="color:#c4b5fd">SHADOW · ${sh.name}</div><span class="hc-chance">ARISE · ${sh.turnsLeft} giliran</span></div>
    <div class="hpbar"><i id="hpMe"></i><span id="hpMeT">${fmt(sh.maxHp)} / ${fmt(sh.maxHp)}</span></div>
    <div class="f-body"><div class="f-title">Bayangan</div><div class="f-skill">ARISE</div><div class="stat-row"><div class="stat">&#9825; ${fmt(sh.maxHp)}</div><div class="stat">${ATKIC} ${fmt(sh.atk)}</div></div></div>`;}
/* Bayangan jatuh / giliran habis → Monarch kembali ke slot dengan HP aslinya (tak tersentuh selama possess). */
function endPossession(){
  if(!bt||!bt.shadow)return;
  const s=bt.shadow;bt.shadow=null;
  bt.pHp=s.retHp;bt.pMax=s.retMax;
  updateMeCard();setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
  setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MONARCH RETURNS","heal");},200);
}
function updateMeCard(){if(!bt)return;const f=document.querySelector(".fighter.me");if(f){if(bt.shadow){f.className="fighter me shadow-fighter";f.dataset.tier="EX";f.dataset.char="";f.style.borderColor="#7c3aed";f.innerHTML=meShadowHtml(bt.shadow);return;}f.className="fighter me"+mutGlow(bt.eq.mut)+shinyCls(bt.eq);f.dataset.tier=bt.eq.tier;f.dataset.char=bt.eq.char;f.style.borderColor=bt.eq.mut&&bt.eq.mut!=="none"?MUT_COLOR[bt.eq.mut]:"";f.innerHTML=meFighterHtml(bt.eq);}}
function benchTile(s){
  return `<div class="bench-sq" data-tier="${s.tier}" style="border-color:${TIER_COLOR[s.tier]}" title="${cardName(s.char)}"><img src="${cardImg(s.char)}" alt="${cardName(s.char)}"><span class="bhp"><i style="width:100%"></i></span></div>`;
}
/* Rail cadangan = 3 kotak gambar sejajar (sisa dek setelah fighter aktif), ditambal placeholder biar tetap 3. */
function benchRailHtml(remaining){
  const list=remaining||[];
  let html="";
  for(let i=0;i<3;i++) html += i<list.length ? benchTile(list[i]) : `<div class="bench-sq empty"></div>`;
  return `<div class="bench-rail">${html}</div>`;
}
/* Bench = kartu dek yang BELUM bertanding (setelah fighter aktif). Saat render awal bt belum ada → pakai equippedList. */
function benchHtml(){
  const list=(bt&&bt.fighters)?bt.fighters.slice(bt.active+1):equippedList().slice(1);
  return benchRailHtml(list);
}
function renderBattle(){
  const lv=state.battle.level,en=enemyOf(lv),es=enemyStats(lv);
  const eq=equipped(),st=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  app.innerHTML=`
  <div class="battle-grid">
  <div class="me-col">
    <div class="fighter me${eq?mutGlow(eq.mut):''}${shinyCls(eq)}" data-tier="${eq?eq.tier:''}" data-char="${eq?eq.char:''}"${eq?mutEdge(eq.mut):''}>${meFighterHtml(eq)}</div>
    ${benchHtml()}
  </div>
  <div class="vs-col"><div class="t">VS</div><div class="s" id="turnLabel">AUTO<br>BATTLE</div><button class="bspeed-btn" id="bspeedBtn" type="button">1×</button></div>
  <div class="me-col foe-side">
    <div class="fighter foe${mutGlow(diffOf().mut)}" data-tier="${en.tier||''}"${mutEdge(diffOf().mut)}>
      <div class="f-banner"><img src="${en.img}" alt="${en.name}"><div class="f-name">${en.name}</div>${diffOf().mut!=="none"?`<div class="f-badges">${mutChip(diffOf().mut,`<span class="fbadge" style="border-color:${MUT_COLOR[diffOf().mut]};color:${MUT_COLOR[diffOf().mut]}">${mutBadge(diffOf().mut)}</span>`)}</div>`:""}
        </div>
      <div class="hpbar"><i id="hpFoe"></i><span id="hpFoeT">${fmt(es.hp)} / ${fmt(es.hp)}</span></div>
      <div class="f-body">
        <div class="f-title">${en.epithet}</div>
        <div class="f-skill">${en.id?passiveName(en.id):"Musuh"}</div>
        <div class="stat-row"><div class="stat">♡ ${fmt(es.hp)}</div><div class="stat">${ATKIC} ${fmt(es.atk)}</div></div>
      </div>
    </div>
    ${benchRailHtml([])}
  </div>
  </div>`;
  wireSpeedBtn();
  playFight(startBattle);
}
function floatText(sel,txt,cls){
  const f=document.querySelector(sel);if(!f)return;
  const r=f.getBoundingClientRect();if(!r.width)return;
  let l=document.getElementById("dmgLayer");
  if(!l){l=document.createElement("div");l.id="dmgLayer";document.body.appendChild(l);}
  const d=document.createElement("div");
  d.className="dmg-float"+(cls?" "+cls:"");d.textContent=txt;
  d.style.left=(r.left+r.width/2)+"px";d.style.top=(r.top-28)+"px";
  l.appendChild(d);setTimeout(()=>d.remove(),950);
}
function anim(sel,cls,noPair){
  const el=document.querySelector(sel);if(!el)return;
  const pulse=(e)=>{e.classList.remove(cls);void e.offsetWidth;e.classList.add(cls);setTimeout(()=>e.classList.remove(cls),520);};
  pulse(el);
}
/* ---------- GALAXY ROAR (Eternal Dragon): charge bola beku -> sembur laser es -> ledakan percikan beku ----------
   Semua timing dibaca dari GALAXY supaya mesin battle (schedPhase / raid.timer / dlyAt) dan
   animasinya tidak saling lepas: kerusakan & getar kartu jatuh tepat di menit GALAXY.hit. */
const GALAXY={chg:520,hit:900,total:2100};
/* Madara Tensa: video Susanoo full-screen di belakang kartu + HUJAN TEBASAN samurai (garis lurus satu layar penuh, kiri→kanan) */
let MADARA_T={wind:280,slash:520,step:120,total:2760};
/* satu tebasan lurus: garis SELEBAR layar penuh (menembus dua tepi), miring random tipis, lewat di sekitar kartu target */
function startBattle(){
  const lv=state.battle.level,en=enemyOf(lv),es=enemyStats(lv);
  const fighters=equippedList();if(!fighters.length)fighters.push(equipped());
  const eq=fighters[0],base=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  const eid=en.id||null,efx=eid?(PASSIVE_FX[eid]||{}):{};
  if(bt&&bt.timer)clearTimeout(bt.timer);
  bt={speed:battleSpeedEff(),fgen:1,lv,en,es,eq,fighters,eid,efx,active:0,revUsed:new Array(fighters.length).fill(false),justTagged:false,pHp:base.hp,pMax:base.hp,eHp:es.hp,turn:1,over:false,eBurn:0,ePoison:0,pGuardDr:0,eAbilityOff:0,voidUsed:false,pCopyFx:null,spCd:[],spTurn:[],spArmed:[],spWave:[],meteorGuard:[],phase2used:false,domainUsed:false,domainLeft:0,eStun:0,pStun:0,pDr:0,pDrTurns:0,atkBuff:new Array(fighters.length).fill(0),dodgeStack:new Array(fighters.length).fill(0),atkCount:new Array(fighters.length).fill(0),standUsed:new Array(fighters.length).fill(false),styleCount:new Array(fighters.length).fill(0),burstStart:new Array(fighters.length).fill(1),entryGuard:new Array(fighters.length).fill(false),dodgeArmed:new Array(fighters.length).fill(false),dodgeCount:new Array(fighters.length).fill(0),execGuard:new Array(fighters.length).fill(false),shatterGuard:new Array(fighters.length).fill(false),wtCount:new Array(fighters.length).fill(0),snatchAtk:new Array(fighters.length).fill(0),snatchHp:new Array(fighters.length).fill(0),regressCharges:new Array(fighters.length).fill(0),bioGuard:new Array(fighters.length).fill(false),splitLeft:new Array(fighters.length).fill(0),splitMult:new Array(fighters.length).fill(1),rumbling:0,rumblingPct:0,defyUsed:new Array(fighters.length).fill(false),defyHold:false,openGuard:true,dsState:new Array(fighters.length).fill(0),aftermath:false,gumTurns:0,trickNext:false,royalNow:false,gunsNow:false,psychic:null,atkEntryGuard:new Array(fighters.length).fill(false),sleepLeft:new Array(fighters.length).fill(0),sleepArmed:new Array(fighters.length).fill(false),overflow:0,rain:null,freezeLeft:0,shockCount:new Array(fighters.length).fill(0),shadow:null,freezeNext:false,valhallaLeft:0,paintHits:[],eInk:0,eInkPct:0,wc:null,rearIdx:-1,rearWaiting:false,rearUsed:[],senzu:{},senzuFin:false,balloon:0,stretchShot:0,turret:0,hvCount:new Array(fighters.length).fill(0),excited:false,weCount:new Array(fighters.length).fill(0),weRevived:false,pbRocks:0,pbKey:"",pbStreak:0,rubber:false,rbBounce:0,dizzyStack:0,dizzyLeft:0};
  // BURST: kartu pertama masuk arena langsung dapat boost HP kalau punya fx.burst
  const fx0=resolveFx(eq,efx);
  if(fx0.burst){bt.pMax=Math.round(base.hp*fx0.burst.mult);bt.pHp=bt.pMax;}
  if(fx0.transform){bt.pMax=Math.round(base.hp*fx0.transform.mult);bt.pHp=bt.pMax;}
  if(fx0.entryCounter)bt.entryGuard[0]=true;
  if(fx0.executeOnEntry)bt.execGuard[0]=true;
  if(fx0.entryShatter)bt.shatterGuard[0]=true;
  if(fx0.entryMaxHp)bt.bioGuard[0]=true;
  if(fx0.meteorWave)bt.meteorGuard[0]=true;
  if(fx0.entryAtkPct)bt.atkEntryGuard[0]=true;
  armShotFx(fx0,0);partyDmgApply(fx0);
  if(fx0.psychicBarrier)bt.psychic={left:fx0.psychicBarrier.turns,dr:fx0.psychicBarrier.dr,healPct:fx0.psychicBarrier.healPct};
  if(fx0.sleepStrike){bt.sleepLeft[0]=fx0.sleepStrike.turns;bt.sleepArmed[0]=true;}
   if(fx0.entryFreeze&&!foeStatusImmune()){bt.eStun=fx0.entryFreeze.turns;bt.freezeLeft=fx0.entryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","BEKU","crit"),bsMs(300));}
   if(fx0.heavyRain)bt.rain={left:fx0.heavyRain.turns,healPct:fx0.heavyRain.healPct};
   if(fx0.timeStop&&!foeStatusImmune()){bt.eStun=fx0.timeStop.turns;setTimeout(()=>floatText(".fighter.foe","THE WORLD","crit"),bsMs(300));}
  if(fx0.dimensionShift){bt.eAbilityOff=fx0.dimensionShift.turns;setTimeout(()=>floatText(".fighter.foe","AMENOMINAKA","crit"),bsMs(300));}
bt.pGuardDr=(fx0&&fx0.puppetBody)?fx0.puppetBody.dr:((fx0&&fx0.autoBlock)?fx0.autoBlock.pct:0);
if(fx0.valhalla){bt.valhallaLeft=fx0.valhalla.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT OF VALHALLA","crit");},bsMs(360));}
if(fx0.senzu){const _szb=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);bt.senzu={baseAtk:_szb.atk,baseHp:bt.pMax,atkSum:0,hpSum:0,turn:0};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MUNCH MUNCH!","heal");},bsMs(420));}
if(fx0.turret)bt.turret=fx0.turret.start;
bt.rubber=!!(fx0&&fx0.rubberField);if(bt.rubber)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","RUBBER FIELD","crit");},bsMs(520));
if(fx0.stretch){setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GOMU GOMU... WAIT WHAT?!","crit");},bsMs(520));}
if(fx0.dupEntry){bt.pMax=Math.round(bt.pMax*2);bt.pHp=bt.pMax;bt.atkBuff[bt.active]+=100;setTimeout(()=>{if(bt&&!bt.over){setBar("hpMe","hpMeT",bt.pHp,bt.pMax);floatText(".fighter.me","DATA DUPLICATED x2","crit");}},bsMs(420));}
if(fx0.worldCorrupt){bt.wc={c:0,atk:Math.round(cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk),every:fx0.worldCorrupt.every,pct:fx0.worldCorrupt.pct,dmgUp:fx0.worldCorrupt.dmgUp};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","ABILITY CORRUPTED","crit");},bsMs(520));}
  bt.fighters.forEach((f,i)=>{const x=resolveFx(f,efx);if(x.splitDeath)bt.splitLeft[i]=x.splitDeath.times;});
  schedPhase(700,step);
}
function tagIn(){
  const next=bt.active+1;
  if(next>=bt.fighters.length)return false;
  bt.active=next;bt.eq=bt.fighters[next];bt.justTagged=true;
  const base=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);
  bt.pMax=base.hp+(bt.snatchHp[next]||0);bt.pHp=bt.pMax;
  bt.burstStart[next]=bt.turn;
  bt.entryGuard[next]=false;bt.dodgeArmed[next]=false;bt.dodgeCount[next]=0;bt.execGuard[next]=false;bt.wtCount[next]=0;bt.shatterGuard[next]=false;bt.bioGuard[next]=false;
  const nfx=resolveFx(bt.eq,bt.efx);
  if(nfx.burst){bt.pMax=Math.round(base.hp*nfx.burst.mult);bt.pHp=bt.pMax;}
  if(nfx.transform){bt.pMax=Math.round(base.hp*nfx.transform.mult);bt.pHp=bt.pMax;}
  if(nfx.entryCounter)bt.entryGuard[next]=true;
  if(nfx.executeOnEntry)bt.execGuard[next]=true;
  if(nfx.entryShatter)bt.shatterGuard[next]=true;
  if(nfx.entryMaxHp)bt.bioGuard[next]=true;
  if(nfx.meteorWave)bt.meteorGuard[next]=true;
  if(nfx.entryAtkPct)bt.atkEntryGuard[next]=true;
  armShotFx(nfx,next);
  if(nfx.psychicBarrier)bt.psychic={left:nfx.psychicBarrier.turns,dr:nfx.psychicBarrier.dr,healPct:nfx.psychicBarrier.healPct};
  if(nfx.sleepStrike){bt.sleepLeft[next]=nfx.sleepStrike.turns;bt.sleepArmed[next]=true;}
   if(nfx.entryFreeze&&!foeStatusImmune()){bt.eStun=nfx.entryFreeze.turns;bt.freezeLeft=nfx.entryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","BEKU","crit"),bsMs(300));}
   if(nfx.heavyRain)bt.rain={left:nfx.heavyRain.turns,healPct:nfx.heavyRain.healPct};
   if(nfx.timeStop&&!foeStatusImmune()){bt.eStun=nfx.timeStop.turns;setTimeout(()=>floatText(".fighter.foe","THE WORLD","crit"),bsMs(300));}
bt.pGuardDr=(nfx&&nfx.puppetBody)?nfx.puppetBody.dr:((nfx&&nfx.autoBlock)?nfx.autoBlock.pct:0);
if(nfx.valhalla){bt.valhallaLeft=nfx.valhalla.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT OF VALHALLA","crit");},bsMs(360));}
if(nfx.senzu){const _szb=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);bt.senzu={baseAtk:_szb.atk,baseHp:bt.pMax,atkSum:0,hpSum:0,turn:0};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MUNCH MUNCH!","heal");},bsMs(420));}
if(nfx.turret)bt.turret=nfx.turret.start;
bt.rubber=!!(nfx&&nfx.rubberField);if(bt.rubber)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","RUBBER FIELD","crit");},bsMs(520));
if(nfx.stretch){setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GOMU GOMU... WAIT WHAT?!","crit");},bsMs(520));}
if(nfx.dupEntry){bt.pMax=Math.round(bt.pMax*2);bt.pHp=bt.pMax;bt.atkBuff[bt.active]+=100;setTimeout(()=>{if(bt&&!bt.over){setBar("hpMe","hpMeT",bt.pHp,bt.pMax);floatText(".fighter.me","DATA DUPLICATED x2","crit");}},bsMs(420));}
if(nfx.worldCorrupt){bt.wc={c:0,atk:Math.round(cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk),every:nfx.worldCorrupt.every,pct:nfx.worldCorrupt.pct,dmgUp:nfx.worldCorrupt.dmgUp};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","ABILITY CORRUPTED","crit");},bsMs(520));}
  // fase 1: kartu aktif sekarang tumbang
  const meEl=document.querySelector(".fighter.me");
  if(meEl){meEl.classList.remove("tag-enter");meEl.classList.add("ko");koFx(meEl);}
  floatText(".fighter.me","KO","crit");
  // fase 2: kartu dek berikutnya naik masuk arena; rail bench diperbarui ke sisa setelahnya
  setTimeout(()=>{
    if(!bt||bt.over)return;
    const me2=document.querySelector(".fighter.me");
    if(me2)me2.classList.remove("ko");
    updateMeCard();
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    const rail=document.querySelector(".bench-rail");if(rail)rail.outerHTML=benchRailHtml(bt.fighters.slice(bt.active+1));
    const me3=document.querySelector(".fighter.me");
    if(me3){me3.classList.add("tag-enter");enterFx(me3);setTimeout(()=>me3.classList.remove("tag-enter"),650);}
    floatText(".fighter.me","TAG-IN!","heal");
  },bsMs(2000));
  return true;
}
function trySave(){
  /* BAYANGAN JATUH: yang mati cuma summoned shadow — Monarch balik utuh, bukan tag-in/kalah */
  if(bt.shadow){endPossession();return true;}
  const a=bt.active,fx=resolveFx(bt.eq,bt.efx);
  /* REGRESSION (Regressor): mati TAPI punya kill tersimpan → bangkit di hpPct% max HP, habisin 1 charge,
     & "skill di-refresh": semua flag sekali-per-battle/window kartu ini di-reset biar balik kayak baru */
  if(fx.regression&&(bt.regressCharges[a]||0)>0){
    bt.regressCharges[a]--;
    bt.pHp=Math.max(1,Math.round(bt.pMax*fx.regression.hpPct/100));
    bt.revUsed[a]=false;bt.standUsed[a]=false;bt.burstStart[a]=bt.turn;bt.weRevived=false;bt.pbRocks=0;bt.pbKey="";bt.pbStreak=0;
    bt.dodgeCount[a]=0;bt.dodgeArmed[a]=false;bt.atkCount[a]=0;bt.wtCount[a]=0;bt.shockCount[a]=0;
    if(fx.entryCounter)bt.entryGuard[a]=true;
    if(fx.executeOnEntry)bt.execGuard[a]=true;
    if(fx.entryShatter)bt.shatterGuard[a]=true;
    if(fx.entryMaxHp)bt.bioGuard[a]=true;
    if(fx.meteorWave)bt.meteorGuard[a]=true;
    if(fx.entryAtkPct)bt.atkEntryGuard[a]=true;
    armShotFx(fx,a);
    if(fx.psychicBarrier)bt.psychic={left:fx.psychicBarrier.turns,dr:fx.psychicBarrier.dr,healPct:fx.psychicBarrier.healPct};
    if(fx.sleepStrike){bt.sleepLeft[a]=fx.sleepStrike.turns;bt.sleepArmed[a]=true;}
     if(fx.entryFreeze&&!foeStatusImmune()){bt.eStun=fx.entryFreeze.turns;bt.freezeLeft=fx.entryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","BEKU","crit"),bsMs(300));}
     if(fx.heavyRain)bt.rain={left:fx.heavyRain.turns,healPct:fx.heavyRain.healPct};
     if(fx.timeStop&&!foeStatusImmune()){bt.eStun=fx.timeStop.turns;setTimeout(()=>floatText(".fighter.foe","THE WORLD","crit"),bsMs(300));}
bt.pGuardDr=(fx&&fx.puppetBody)?fx.puppetBody.dr:((fx&&fx.autoBlock)?fx.autoBlock.pct:0);
if(fx.valhalla){bt.valhallaLeft=fx.valhalla.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT OF VALHALLA","crit");},bsMs(360));}
if(fx.senzu){const _szb=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);bt.senzu={baseAtk:_szb.atk,baseHp:bt.pMax,atkSum:0,hpSum:0,turn:0};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MUNCH MUNCH!","heal");},bsMs(420));}
if(fx.turret)bt.turret=fx.turret.start;
bt.rubber=!!(fx&&fx.rubberField);
if(fx.stretch){setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GOMU GOMU... WAIT WHAT?!","crit");},bsMs(520));}
if(fx.dupEntry){bt.pMax=Math.round(bt.pMax*2);bt.pHp=bt.pMax;bt.atkBuff[bt.active]+=100;setTimeout(()=>{if(bt&&!bt.over){setBar("hpMe","hpMeT",bt.pHp,bt.pMax);floatText(".fighter.me","DATA DUPLICATED x2","crit");}},bsMs(420));}
if(fx.worldCorrupt){bt.wc={c:0,atk:Math.round(cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk),every:fx.worldCorrupt.every,pct:fx.worldCorrupt.pct,dmgUp:fx.worldCorrupt.dmgUp};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","ABILITY CORRUPTED","crit");},bsMs(520));}
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","REGRESSION","heal");},bsMs(400));
    return true;
  }
  /* SPLIT DEATH (BIOKINESIS): mati TAPI charge terbelah masih ada -> badan baru pct% stat (kumulatif),
     HP penuh di max baru, ATK menyusut via bt.splitMult. Flag sekali-per-battle di-refresh kayak regression,
     TAPI efek "saat masuk" TIDAK re-arm (biar entry damage gak triple-dip tiap split). */
  if(fx.splitDeath&&(bt.splitLeft[a]||0)>0){
    bt.splitLeft[a]--;
    bt.splitMult[a]=(bt.splitMult[a]||1)*fx.splitDeath.pct/100;
    bt.pMax=Math.max(1,Math.round(bt.pMax*fx.splitDeath.pct/100));
    bt.pHp=bt.pMax;
    bt.revUsed[a]=false;bt.standUsed[a]=false;bt.burstStart[a]=bt.turn;bt.weRevived=false;bt.pbRocks=0;bt.pbKey="";bt.pbStreak=0;
    bt.dodgeCount[a]=0;bt.dodgeArmed[a]=false;bt.atkCount[a]=0;bt.wtCount[a]=0;bt.shockCount[a]=0;
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","SPLIT!","heal");},bsMs(400));
    return true;
  }
  /* V-DRIVE RESONANCE (TIME TRICKSTER): mati -> bangkit pct% max HP (sekali) + damage musuh sejumlah heal itu + stun */
  if(fx.rewind&&!bt.revUsed[a]){
    bt.revUsed[a]=true;
    const rh=Math.max(1,Math.round(bt.pMax*fx.rewind.pct/100));
    bt.pHp=Math.min(bt.pMax,rh);
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    if(bt.eHp>0){
      bt.eHp-=rh;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","REWIND -"+fmt(rh),"crit");}},bsMs(420));
    }
    if(fx.rewind.stun&&!foeStatusImmune()){bt.eStun=Math.max(bt.eStun||0,fx.rewind.stun);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","REWOUND!","crit");},bsMs(560));}
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","V-DRIVE RESONANCE +"+fmt(rh),"heal");},bsMs(300));
    return true;
    }
  /* THE WORLD ENDER (DARKIN LORD): kematian PERTAMA -> revive penuh + DR 40% permanen + heal bonus */
  if(fx.worldEnder&&!bt.revUsed[a]){
    bt.revUsed[a]=true;bt.pHp=bt.pMax;bt.weRevived=true;
    bt.pDr=Math.max(bt.pDr||0,fx.worldEnder.revive.dr);bt.pDrTurns=9999;
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>floatText(".fighter.me","THE WORLD ENDER","crit"),bsMs(400));
    return true;
  }
  /* PSYCHIC OVERLOAD (PSYCHIC ESPER): kematian PERTAMA -> full HP + 10 batu per serangan */
  if(fx.psychicBarrage&&!bt.revUsed[a]){
    bt.revUsed[a]=true;bt.pHp=bt.pMax;bt.pbRocks=fx.psychicBarrage.reviveRocks;
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>floatText(".fighter.me","PSYCHIC OVERLOAD","crit"),bsMs(400));
    return true;
  }
  if(fx.revive&&!bt.revUsed[a]){
    bt.revUsed[a]=true;bt.pHp=(fx.revive.pct!=null)?Math.max(1,Math.round(bt.pMax*fx.revive.pct/100)):bt.pMax;if(fx.revive.atkPct)bt.atkBuff[a]+=fx.revive.atkPct;
    if(fx.revive.lock){bt.eAbilityOff=Math.max(bt.eAbilityOff||0,fx.revive.lock);setTimeout(()=>floatText(".fighter.foe","ALTER THE FUTURE","crit"),bsMs(600));}
    setTimeout(()=>floatText(".fighter.me","REVIVE!","heal"),bsMs(400));
    if(fx.revive.stun&&!foeStatusImmune()){bt.eStun=Math.max(bt.eStun||0,fx.revive.stun);setTimeout(()=>floatText(".fighter.foe","INK DEMON STUN","crit"),bsMs(520));}
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    return true;
  }
  /* LAST STAND: fatal pertama ditahan di 1 HP (bukan bangkit penuh) + langsung dapat bonus ATK */
  if(fx.lastStand&&!bt.standUsed[a]){
    bt.standUsed[a]=true;bt.pHp=1;bt.atkBuff[a]+=fx.lastStand.pct;
    setTimeout(()=>floatText(".fighter.me","1% AWAKENED","crit"),bsMs(400));
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    return true;
  }
  /* PRIDE OF THE PRINCE: kartu party ini beneran jatuh (revive/lastStand gak nolong) → semua Royal Vanguard di party +pct% ATK permanen (stack di atkBuff, kepakai pas dia masuk/aktif) */
  for(let i=0;i<bt.fighters.length;i++){const pfx=resolveFx(bt.fighters[i],bt.efx);if(pfx.prideOfPrince)bt.atkBuff[i]=(bt.atkBuff[i]||0)+pfx.prideOfPrince.pct;}
  /* RUMBLING: kartu ini beneran tumbang (revive/lastStand gak nolong) → nyalain DoT post-mortem */
  if(fx.rumbling){bt.rumbling=fx.rumbling.turns;bt.rumblingPct=fx.rumbling.pct;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","THE RUMBLING","burn");},bsMs(600));}
  /* DEATH HEX (ICE REAPER): beneran tumbang -> freeze turns + ePoison atkCut */
  if(fx.deathHex){
    if(!foeStatusImmune()){bt.eStun=Math.max(bt.eStun||0,fx.deathHex.turns);bt.freezeLeft=Math.max(bt.freezeLeft||0,fx.deathHex.turns);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","HAKKA NO TOGAME · BEKU","crit");},bsMs(520));}
    bt.ePoison=Math.min(90,(bt.ePoison||0)+fx.deathHex.atkCut);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","-"+fx.deathHex.atkCut+"% ATK PERMANEN","burn");},bsMs(640));
  }
  /* DEATH REAR (THE GRIEFER): mati PERTAMA kali -> remove dari rotasi sekarang, nunggu balik di belakang party */
  if(fx.deathRear&&!bt.rearUsed[a]){
    bt.rearUsed[a]=true;bt.rearIdx=a;bt.rearWaiting=true;
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","REMOVED FROM LINE","miss");},bsMs(400));
  }
  if(a+1<bt.fighters.length){tagIn();return true;}
  /* LAST CARD MATI tapi Rumbling masih jalan → jangan langsung kalah; masuk mode aftermath (DoT tick doang) */
  if(bt.rumbling>0){bt.aftermath=true;return true;}
  /* REAR RETURN (THE GRIEFER): rantai party habis -> balik sebagai kartu terakhir dgn hpPct% HP */
  if(bt.rearWaiting&&bt.rearIdx>=0){
    const ri=bt.rearIdx;bt.rearWaiting=false;
    const rfx=resolveFx(bt.fighters[ri],bt.efx);
    bt.active=ri;bt.eq=bt.fighters[ri];bt.justTagged=true;
    const rbase=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);
    bt.pMax=rbase.hp+(bt.snatchHp[ri]||0);
    bt.pHp=Math.max(1,Math.round(bt.pMax*((((rfx.deathRear||{}).hpPct)||50)/100)));
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","WORLD REWIND!","heal");},bsMs(400));
    return true;
  }
  return false;
}
function setBar(id,tid,cur,max){
  const b=document.getElementById(id);if(!b)return;
  b.style.width=Math.max(0,cur/max*100)+"%";
  const t=tid?document.getElementById(tid):null;if(t)t.textContent=fmt(Math.max(0,cur))+" / "+fmt(max);
}
function step(){ if(!bt||bt.over)return; schedPhase(0,playerPhase); }
// Safe scheduler: guarantees the battle can never hang. If a phase throws,
// the chain is broken (no next timer) — so we force an end instead of freezing.
function schedPhase(ms,fn){
  if(!bt)return;
  clearTimeout(bt.timer);/* timer basi dibatalkan: schedule terakhir menang — cegah rantai giliran dobel */
  bt.timer=setTimeout(()=>{
    bt.timer=null;
    try{ fn(); }
    catch(err){
      console.error("battle phase error",err);
      if(bt&&!bt.over){ bt.timer=null; endBattle(bt.eHp<=0); }
    }
  },bsMs(ms));
}
/* ===== Renderer serangan SATU untuk semua kartu: user & musuh tinggal tukar sisi (A=penyerang, D=target) ===== */
function attackLunge(sel,wind){const foe=sel===".fighter.foe";anim(sel,wind?(foe?"windlunge-l":"windlunge-r"):(foe?"lunge-l":"lunge-r"));}
/* ===== JUICE serangan generik (prototipe attack-fx) — HANYA kartu normal, jalur ULT/galaxy gak disentuh ===== */
function shakeScreen(big){const g=document.querySelector(".battle-grid");if(!g)return;const cls=big?"shk-big":"shk";g.classList.remove("shk","shk-big");void g.offsetWidth;g.classList.add(cls);setTimeout(()=>g.classList.remove(cls),big?460:300);}
function hitStop(ms){const g=document.querySelector(".battle-grid");if(!g)return;g.classList.add("hitstop");setTimeout(()=>g.classList.remove("hitstop"),ms||90);}
function impactFx(Dsel,big){const f=document.querySelector(Dsel);if(!f)return;const box=document.createElement("div");box.className="impact"+(big?" crit":"");box.innerHTML='<span class="im-flash go"></span><span class="im-slash go"></span><span class="im-slash two go"></span>';const n=big?16:8;for(let i=0;i<n;i++){const s=document.createElement("span");s.className="im-spark go";s.style.setProperty("--a",(Math.random()*360).toFixed(1)+"deg");s.style.setProperty("--d",Math.round(40+Math.random()*(big?150:90))+"px");s.style.animationDelay=(Math.random()*.05).toFixed(2)+"s";box.appendChild(s);}f.appendChild(box);setTimeout(()=>box.remove(),big?700:560);}
function speedLines(big){let l=document.getElementById("speedLayer");if(!l){l=document.createElement("div");l.id="speedLayer";document.body.appendChild(l);}l.className=big?"crit":"";const n=big?14:8;for(let i=0;i<n;i++){const s=document.createElement("span");s.className="spd-line";s.style.top=(Math.random()*100).toFixed(1)+"%";s.style.animationDelay=(Math.random()*.08).toFixed(2)+"s";l.appendChild(s);}setTimeout(()=>{l.innerHTML="";},520);}
/* ===== MASUK / MATI kartu (prototipe card-enter-death) — di-inject, markup kartu gak diubah ===== */
function enterFx(el){if(!el)return;const fx=document.createElement("div");fx.className="enter-fx";fx.innerHTML='<span class="ef-flash"></span><span class="ef-sheen"></span>';el.appendChild(fx);setTimeout(()=>{try{fx.remove();}catch(e){}},900);const r=el.getBoundingClientRect();const ring=document.createElement("div");ring.className="shock-ring";ring.style.left=(r.left+r.width/2)+"px";ring.style.top=(r.top+r.height*0.92)+"px";document.body.appendChild(ring);setTimeout(()=>{try{ring.remove();}catch(e){}},700);}
function koFx(el){if(!el)return;for(let i=0;i<14;i++){const s=document.createElement("span");s.className="ko-shard";s.style.left=(30+Math.random()*40).toFixed(0)+"%";s.style.top=(30+Math.random()*40).toFixed(0)+"%";s.style.setProperty("--sx",(Math.random()*260-130).toFixed(0)+"px");s.style.setProperty("--sy",(Math.random()*220+20).toFixed(0)+"px");s.style.setProperty("--sr",(Math.random()*720-360).toFixed(0)+"deg");s.style.animationDelay=(Math.random()*.12).toFixed(2)+"s";el.appendChild(s);setTimeout(()=>{try{s.remove();}catch(e){}},950);}const st=document.createElement("div");st.className="ko-stamp";st.textContent="K.O.";document.body.appendChild(st);setTimeout(()=>{try{st.remove();}catch(e){}},760);}
function performAttack(o){
  const A=o.A,D=o.D,id=o.id,shots=o.shots;
  const md=o.ranton&&id==="CH_EX_MADARA";
  /* Galaxy Roar = SATU sambaran (waktu damage dipindah ke menit FX); Madara Tensa = HUJAN 15 tebasan,
     tiap sambaran dijadaki MADARA_T.step supaya angka + getar mendarat bareng garisnya. */
  const galaxy=!!o.galaxy;
  const ultBarrage=(o.domainStrike||o.ariseMode||md);
  /* ARISE sengaja TIDAK ikut grid 80ms domain/shrine: 9 sambaran di 80ms cuma kebaca satu getar panjang.
     Pakai ritme sambaran normal (160ms) → 9 hit = 1,28s, masih muat di jendela fase ARISE (2,2s). */
  const hstep=o.domainStrike?80:160;
  const hoff=galaxy?0:md?40:(o.domainStrike||o.ariseMode)?60:500;
  /* Bar dicicil PROPORSIONAL terhadap total damage: damage yang melebihi HP target (one-hit kill)
     tetap tampil nguras dari penuh sampai 0, bukan nyangkut di 100% lalu langsung kosong. */
  const startHp=Math.max(0,Math.min(o.defMax,o.defHpStart));
  const endHp=Math.max(0,o.defHpEnd);
  const span=Math.max(0,startHp-endHp);
  const hpAt=(cum)=>o.total>0?Math.max(endHp,Math.round(startHp-span*Math.min(1,cum/o.total))):endHp;
  const wind=!(ultBarrage||galaxy);
  attackLunge(A,wind);
  if(wind)setTimeout(()=>{if(bt&&!bt.over)swing();},bsMs(120));
  setTimeout(()=>{
    if(!bt)return;
    const self=(o.domainStrike?o.fx.domain:o.ariseMode?o.fx.barrage:null);
    if(self&&self.selfStun&&o.recharge)o.recharge(self);
    /* jurus hujan tebasan MILIK Madara saja — kartu lain (termasuk UR) gak boleh nyomot animasi EX cuma karena punya flag ranton */
    const susStart=(o.ranton&&id==="CH_EX_MADARA"&&!bt.over)?MADARA_T.slash:0;
    const dlyAt=i=> galaxy ? GALAXY.hit : md ? (susStart+i*MADARA_T.step) : (i*hstep+susStart);
    /* Jin-Woo: cakar ARISE digambar 170ms setelah menit sambaran, jadi getarnya ikut digeser supaya getar & visual mendarat bareng */
    const jwLag=(id==="CH_EX_JINWOO"&&o.barrageN&&!o.domainStrike)?170:0;
    let cum=0,barEnd=0;
    shots.forEach((s,i)=>{
      if(s.evade||s.miss){playDodge();floatText(D,s.evade?"DODGE":"MISS","miss");return;}
      if(s.void){anim(D,"hit");setTimeout(()=>floatText(D,"VOID","miss"),bsMs(120));return;}
      const dl=dlyAt(i),ft=dl+(md?40:hoff);
      if(!galaxy&&!md&&(o.domainStrike||(id!=="CH_EX_MADARA"&&id!=="CH_EX_GOJO")))setTimeout(()=>playClip(punchAudio),bsMs(dl));
      setTimeout(()=>{if(bt&&!bt.over){anim(D,"hit",ultBarrage);if(!ultBarrage&&!galaxy){const big=!!(o.crit&&i===shots.length-1);impactFx(D,big);shakeScreen(big);hitStop(big?140:80);if(!o.barrageN||big)speedLines(big);if(big)sfx.crit(),critBoom();}}},bsMs(dl+jwLag));
      cum+=s.d;barEnd=Math.max(barEnd,ft);const stepHp=hpAt(cum);
      setTimeout(()=>floatText(D,"-"+fmt(s.d),(o.crit&&i===shots.length-1)?"crit":""),bsMs(ft));
      setTimeout(()=>setBar(o.barId,o.barTid,stepHp,o.defMax),bsMs(ft));
      if(s.pierce)setTimeout(()=>floatText(D,"PIERCE","crit"),bsMs(180));
    });
    setTimeout(()=>{
      /* Safety net (pola sama dgn schedPhase): rantai kematian jalan di timeout mentah ini —
         satu exception = battle STUCK tanpa UI/reward. Tangkap + paksa endBattle. */
      try{
        if(bt&&!bt.over)setBar(o.barId,o.barTid,endHp,o.defMax);
        if(bt&&o.onAnimEnd)o.onAnimEnd();
      }catch(err){
        console.error("onAnimEnd error",err);
        if(bt&&!bt.over){ try{ bt.timer=null; endBattle(bt.eHp<=0); }catch(e2){ console.error("force endBattle error",e2); } }
      }
    },bsMs(barEnd+520));
    if(o.barrageN>1)setTimeout(()=>floatText(D,(o.iceBlast?"ICE BLAST ×":o.domainStrike?"UNLIMITED VOID ×":o.ariseMode?"ARISE ×":md?"TENSA ×":"CLEAVE ×")+o.barrageN,"crit"),bsMs(md?MADARA_T.slash:320));
    else if(shots.length>1&&!o.ranton)setTimeout(()=>floatText(D,"DOUBLE!","crit"),bsMs(260));
  },bsMs(180));
}
function setTurnPill(side,label){
  const col=document.querySelector(".vs-col");if(!col)return;
  const t=col.querySelector(".t");if(!t)return;
  col.classList.toggle("foe",side==="foe");
  t.textContent=label;
}
function playerPhase(){
  if(!bt||bt.over)return;
  bt.foeDowning=false;/* kill berikutnya baru sah setelah giliran ini mulai */
  if(bt.turn>300){ endBattle(bt.eHp<=bt.pHp); return; }
  /* AFTERMATH: kartu terakhir udah mati, Rumbling doang yang jalan — bisa nyulik menang, abis itu kalah */
  if(bt.aftermath){
    if(bt.rumbling>0&&foeStatusImmune()){bt.rumbling=0;setTimeout(()=>floatText(".fighter.foe","IMMUNE · RUMBLING","heal"),bsMs(160));}
    if(bt.rumbling>0){
      const rd=Math.round(bt.es.hp*(bt.rumblingPct||10)/100);
      bt.eHp-=rd;bt.rumbling--;
      setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","RUMBLING -"+fmt(rd),"burn");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
      bt.turn++;schedPhase(1000,playerPhase);return;
    }
    endBattle(false);return;
  }
  /* SHADOW MONARCH: bayangan megang slot — tiap giliran dihitung mundur, habis → Monarch balik */
  if(bt.shadow){ if(bt.shadow.turnsLeft<=0){ endPossession(); } else { bt.shadow.turnsLeft--; } }
  bt.justTagged=false;
  bt.trickNext=false;bt.royalNow=false;bt.gunsNow=false;
  const id=bt.eq.char,t=bt.turn;let fx=resolveFx(bt.eq,bt.efx);
  if(bt.shadow)fx={};
  /* UNLIMITED VOID (BLESSED SORCERER): HP < below% max -> set ke healPct% + stun musuh turns, sekali per battle */
  if(fx.unlimitedVoid&&!bt.voidUsed&&bt.pHp<bt.pMax*fx.unlimitedVoid.below/100){
    bt.voidUsed=true;
    bt.pHp=Math.max(bt.pHp,Math.round(bt.pMax*fx.unlimitedVoid.healPct/100));
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","UNLIMITED VOID","heal");},bsMs(220));
    if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE Â· VOID","heal"),bsMs(460));}
    else{bt.eStun+=fx.unlimitedVoid.turns;setTimeout(()=>floatText(".fighter.foe","UNLIMITED VOID","crit"),bsMs(460));}
  }
  document.getElementById("turnLabel").innerHTML=(bt.tower&&towerRun)?("LANTAI <b>"+towerRun.floor+"</b> · GELOMBANG <b>"+(towerRun.idx+1)+"/"+towerRun.waves.length+"</b>"):("TURN<br>"+t);
  setTurnPill("you","GILIRANMU");
  /* EVOLUTION TURRET (YORDLE INVENTOR): tiap `every` giliran -> +1 turret */
  if(fx.turret&&bt.turn%fx.turret.every===0){bt.turret++;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TURRET +1 ("+bt.turret+")","heal");},bsMs(320));}
  /* RUMBLING: DoT sisa dari kartu yang udah mati — jalan tiap giliran walau kartu udah ganti */
  if(bt.rumbling>0&&foeStatusImmune()){bt.rumbling=0;setTimeout(()=>floatText(".fighter.foe","IMMUNE · RUMBLING","heal"),bsMs(160));}
  if(bt.rumbling>0){
    const rd=Math.round(bt.es.hp*(bt.rumblingPct||10)/100);
    bt.eHp-=rd;bt.rumbling--;
    setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","RUMBLING -"+fmt(rd),"burn");}},bsMs(200));
    if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
  }
  /* HEAVY RAIN (OCEAN'S GUARDIAN): selama hujan aktif, kartu ini pulih `healPct`% max HP tiap giliran — jalan walau kena stun (spt turnMaxHp); hujan habis setelah `left` giliran */
  if(bt.rain&&bt.rain.left>0){
    const rh=Math.max(1,Math.round(bt.pMax*bt.rain.healPct/100));
    bt.pHp=Math.min(bt.pMax,bt.pHp+rh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","HUJAN +"+fmt(rh),"heal");},bsMs(260));
    bt.rain.left--;
  }
  /* rotasi snapshot HP buat CAUSALITY (ASTRAL DEVOURER): pHp awal giliran ini jadi hp pembanding giliran berikutnya */
  bt.causalPrev=(bt.causalNow==null)?bt.pHp:bt.causalNow;bt.causalNow=bt.pHp;
  /* STAT GROW (SOLAR BRAWLER / ANT KING): semua stat naik pct% compound per giliran */
  if(fx.statGrow&&bt.pHp>0){const sgd=Math.round(bt.pMax*fx.statGrow.pct/100);bt.pMax+=sgd;bt.pHp+=sgd;bt.atkBuff[bt.active]+=fx.statGrow.pct;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","STATS +"+fx.statGrow.pct+"%","heal");},bsMs(300));}
  /* REGEN (BLOODMOON DEMON): pulih pct% max HP tiap giliran, jalan walau kena stun; berhenti di bawah stopBelow% max HP */
  if(fx.regen&&bt.pHp>0&&!(fx.regen.stopBelow!=null&&bt.pHp<bt.pMax*fx.regen.stopBelow/100)){const rh2=Math.max(1,Math.round(bt.pMax*fx.regen.pct/100));bt.pHp=Math.min(bt.pMax,bt.pHp+rh2);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","REGEN +"+fmt(rh2),"heal");},bsMs(260));}
  /* METEOR PERIODIC (CRIMSON WARLORD): tiap `every` giliran sejak masuk -> aoe pct% max HP musuh (boss kebal) */
  if(fx.meteorShower&&bt.pHp>0&&bt.eHp>0){bt.msLast=bt.msLast||new Array(bt.fighters.length).fill(-99);if(bt.msLast[bt.active]==null||bt.msLast[bt.active]<-90)bt.msLast[bt.active]=bt.turn;if(bt.turn-bt.msLast[bt.active]>=fx.meteorShower.every){aoeMaxHpFire(fx.meteorShower.pct,"METEOR BERIKUTNYA",true);bt.msLast[bt.active]=bt.turn;}}
  /* TURN MAX HP (BIOKINESIS): tiap giliran kartu ini aktif & hidup, kartu aktif musuh rugi pct% MAX HP (flat).
     Ditaruh SEBELUM cek stun biar aura tetap nyala walau kartu kena stun. Boss NPC kebal. */
  if(fx.turnMaxHp&&!bt.en.boss&&!foeStatusImmune()&&bt.eHp>0){
    const td=Math.max(1,Math.round(bt.es.hp*fx.turnMaxHp.pct/100));
    bt.eHp-=td;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","BIOKINESIS -"+fmt(td),"burn");}},bsMs(200));
    if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
  }
  if(bt.pStun>0){
    if(fx.statusImmune){
      /* STATUS IMMUNE: stun DIBATALKAN — giliran tetap jalan */
      bt.pStun=0;
      setTimeout(()=>floatText(".fighter.me","IMMUNE · STUN","heal"),bsMs(200));
    }else{
      bt.pStun--;
      const lbl=(bt.pDrTurns>0&&bt.pDr)?"STUN · DR "+bt.pDr+"%":"STUN";
      setTimeout(()=>floatText(".fighter.me",lbl,"crit"),bsMs(200));
      schedPhase(600,enemyPhase);
      return;
    }
  }
  const efx=bt.efx||{};
  const a=bt.active;
  /* SLEEP STRIKE (THUNDER PRODIGY): tidur N giliran sejak masuk — serangan dilewati;
     begitu hitung tidur habis, serangan berikutnya di-arm ×mult (lihat blok dmgMult) */
  if(fx.sleepStrike&&(bt.sleepLeft[a]||0)>0){
    bt.sleepLeft[a]--;
    if(bt.sleepLeft[a]===0){bt.sleepArmed[a]=true;setTimeout(()=>floatText(".fighter.me","BANGUN!","heal"),bsMs(200));}
    else setTimeout(()=>floatText(".fighter.me","TERTIDUR","miss"),bsMs(200));
    schedPhase(600,enemyPhase);
    return;
  }
    /* SERIOUS PUNCH (BALD KING): charge giliran tanpa menyerang -> giliran ke-charge arm pukulan -> cd giliran */
  if(fx.seriousPunch){
    if((bt.spCd[a]||0)>0){bt.spCd[a]=(bt.spCd[a]||0)-1;if(bt.spCd[a]>0)setTimeout(()=>floatText(".fighter.me","SERIOUS PUNCH Â· CD "+bt.spCd[a],"miss"),bsMs(200));schedPhase(600,enemyPhase);return;}
    bt.spTurn[a]=(bt.spTurn[a]||0)+1;
    if(bt.spTurn[a]<fx.seriousPunch.charge){setTimeout(()=>floatText(".fighter.me","CHARGING... "+bt.spTurn[a]+"/"+fx.seriousPunch.charge,"miss"),bsMs(200));schedPhase(600,enemyPhase);return;}
    bt.spTurn[a]=0;bt.spCd[a]=fx.seriousPunch.cd;bt.spArmed[a]=true;
  }
  /* DESPERATE STRIKE: di bawah below% HP -> serangan berikutnya ×mult, sesudahnya tewas di akhir giliran */
  if(fx.desperateStrike&&bt.dsState[a]===0&&bt.pHp>0&&bt.pHp<bt.pMax*fx.desperateStrike.below/100)bt.dsState[a]=1;
  /* DODGE EVERY: setiap N giliran sejak masuk, pasti hindari serangan musuh giliran ini */
  if(fx.dodgeEvery){bt.dodgeCount[a]=(bt.dodgeCount[a]||0)+1;if(bt.dodgeCount[a]%fx.dodgeEvery.turns===0)bt.dodgeArmed[a]=true;}
  /* EXECUTE ON ENTRY (SUPERNOVA): saat masuk, kalau HP musuh < pct% HP kartu ini, hancurkan instan */
  /* ERASE (OMNI SOVEREIGN): entry -> total stat musuh < milik kartu ini -> hapus (pola executeOnEntry) */
  if(fx.eraseOnEntry&&bt.eraseGuard&&bt.eraseGuard[a]){
    bt.eraseGuard[a]=false;
    const ownS=cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny);
    if(bt.eHp>0&&(bt.es.hp+bt.es.atk)<(ownS.hp+ownS.atk)){
      bt.eHp=0;setBar("hpFoe","hpFoeT",0,bt.es.hp);
      setTimeout(()=>{anim(".fighter.foe","ko");floatText(".fighter.foe","HAPUS EKSISTENSI","crit");},bsMs(200));
      setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));
      return;
    }
  }
  if(fx.executeOnEntry&&bt.execGuard[a]){
    bt.execGuard[a]=false;
    const thr=Math.round(cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).hp*fx.executeOnEntry.pct/100);
    if(bt.eHp>0&&bt.eHp<thr){
      bt.eHp=0;setBar("hpFoe","hpFoeT",0,bt.es.hp);
      setTimeout(()=>{anim(".fighter.foe","ko");floatText(".fighter.foe","SUPERNOVA","crit");},bsMs(200));
      setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));
      return;
    }
  }
    /* METEORIC BURST (METEOR CONQUEROR): saat masuk, ledakan meteror -> damage FLAT pct% MAX HP kartu ini ke musuh aktif (bypass evasion/void), sekali per masuk */
  if(fx.meteorWave&&bt.meteorGuard[a]){
    bt.meteorGuard[a]=false;
    if(bt.eHp>0){
      const md=Math.max(1,Math.round(bt.pMax*fx.meteorWave.pct/100));
      bt.eHp-=md;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","METEORIC BURST -"+fmt(md),"crit");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
    }
  }
  /* ENTRY SHATTER (ALMIGHTY PUSH): saat masuk, ledakan memecah -> damage flat sebesar pct% dari total HP musuh saat ini (bypass evasion/void, spt wallTitans) */
  if(fx.entryShatter&&bt.shatterGuard[a]){
    bt.shatterGuard[a]=false;
    if(bt.eHp>0){
      const sd=Math.max(1,Math.round(bt.eHp*fx.entryShatter.pct/100));
      bt.eHp-=sd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","ALMIGHTY PUSH -"+fmt(sd),"crit");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
    }
  }
  /* PAPER STORM (PAPER PAL): saat masuk, serpihan kertas memberikan damage FLAT sebesar pct% dari ATK kartu ini ke kartu aktif musuh (bypass evasion/void spt entryShatter). Sekali per masuk. */
  if(fx.entryAtkPct&&bt.atkEntryGuard[a]){
    bt.atkEntryGuard[a]=false;
    if(bt.eHp>0){
      const ownAtk=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk;
      const pd=Math.max(1,Math.round(ownAtk*fx.entryAtkPct.pct/100));
      bt.eHp-=pd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe",passiveName(id)+" -"+fmt(pd),"crit");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
    }
  }
  /* ENTRY MAX HP (BIOKINESIS): saat masuk, kartu aktif musuh rugi pct% MAX HP sebagai damage flat (bypass evasion/void).
     Boss NPC kebal. Guard sekali-per-masuk persis pola entryShatter. */
  if(fx.entryMaxHp&&bt.bioGuard[a]){
    bt.bioGuard[a]=false;
    if(bt.eHp>0&&!bt.en.boss&&!foeStatusImmune()){
      const bd=Math.max(1,Math.round(bt.es.hp*fx.entryMaxHp.pct/100));
      bt.eHp-=bd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","BIOKINESIS -"+fmt(bd),"crit");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
    }
  }
  /* LIFETIME: kartu self-destruct setelah N giliran sejak masuk arena */
  if(fx.lifetime&&(t-(bt.burstStart[a]||1))>=fx.lifetime.turns){
    bt.pHp=0;setBar("hpMe","hpMeT",0,bt.pMax);
    setTimeout(()=>{anim(".fighter.me","ko");floatText(".fighter.me","LIFETIME UP","crit");},bsMs(200));
    setTimeout(()=>{if(!bt||bt.over)return;if(!trySave()){endBattle(false);return;}schedPhase(bt.justTagged?2700:700,playerPhase);},bsMs(900));
    return;
  }
  /* BURST: revert HP ke normal kalau masa burst sudah lewat (tanpa lifetime) */
  if(fx.burst&&(t-(bt.burstStart[a]||1))>=fx.burst.turns){
    const baseHp=cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).hp;
    if(bt.pMax>baseHp){bt.pMax=baseHp;if(bt.pHp>bt.pMax)bt.pHp=bt.pMax;setBar("hpMe","hpMeT",bt.pHp,bt.pMax);}
  }
    /* OVERHEAT (METEOR CONQUEROR): setelah delay giliran sejak masuk -> rugi pct% MAX HP sendiri tiap giliran; habis -> tewas (pola lifetime) */
  if(fx.overheat&&(t-(bt.burstStart[a]||1))>=fx.overheat.delay){
    const oh=Math.max(1,Math.round(bt.pMax*fx.overheat.pct/100));
    bt.pHp=Math.max(0,bt.pHp-oh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","OVERHEAT -"+fmt(oh),"burn");}},bsMs(200));
    if(bt.pHp<=0){setTimeout(()=>{if(!bt||bt.over)return;if(!trySave()){endBattle(false);return;}schedPhase(bt.justTagged?2700:700,playerPhase);},bsMs(900));return;}
  }
  /* BERSERKER ARMOR (THE STRUGGLER): tiap giliran rugi selfDmgPct% max HP + atkGainPct% ATK stack; HP < lowPct% -> undying undyingTurns giliran + xatkMult; habis -> tewas */
  if(fx.berserker){
    const bzk=fx.berserker;
    if((bt.berserkLeft||0)>0){
      bt.berserkLeft--;
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","BERSERKER TURNS "+bt.berserkLeft,"crit");},bsMs(240));
      if(bt.berserkLeft<=0){
        bt.berserkOn=false;
        setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","ko");floatText(".fighter.me","ARMOR HABIS","crit");}},bsMs(220));
        setTimeout(()=>{if(bt&&!bt.over)endBattle(false);},bsMs(900));
        return;
      }
    }
    const bzd=Math.max(1,Math.round(bt.pMax*bzk.selfDmgPct/100));
    bt.pHp-=bzd;bt.atkBuff[a]+=bzk.atkGainPct;
    setTimeout(()=>{if(bt&&!bt.over){floatText(".fighter.me","BERSERK -"+fmt(bzd)+" +"+bzk.atkGainPct+"% ATK","burn");}},bsMs(200));
    if(!bt.berserkOn&&bt.pHp<=bt.pMax*bzk.lowPct/100){
      bt.berserkOn=true;bt.berserkLeft=bzk.undyingTurns;
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","BERSERKER ARMOR!","crit");},bsMs(420));
    }
    if(bt.pHp<=0&&!bt.berserkOn){
      setTimeout(()=>{if(!bt||bt.over)return;if(!trySave()){endBattle(false);return;}schedPhase(bt.justTagged?2700:700,playerPhase);},bsMs(900));
      return;
    }
  }
   /* TWILIGHT OF VALHALLA (HEIGHT OF PAINTING): tiap giliran selama aktif -> +atkPct% ATK stack; countdown habis -> heal healPct% max HP */
   if(fx.valhalla&&(bt.valhallaLeft||0)>0){
     const vl=fx.valhalla;
     bt.atkBuff[a]+=vl.atkPct;bt.valhallaLeft--;
     setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT +"+vl.atkPct+"% ATK","heal");},bsMs(240));
     if(bt.valhallaLeft<=0){
       const vh=Math.max(1,Math.round(bt.pMax*vl.healPct/100));
       bt.pHp=Math.min(bt.pMax,bt.pHp+vh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
       setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT HABIS +"+fmt(vh),"heal");},bsMs(460));
     }
   }
  let atk=cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk;
  if(bt.atkBuff[a])atk=Math.round(atk*(1+bt.atkBuff[a]/100));
  /* SPLIT DEATH: ATK badan hasil terbelah ikut menyusut (kumulatif, gaya snatchAtk) */
  if(bt.splitMult&&bt.splitMult[a])atk=Math.round(atk*bt.splitMult[a]);
  if(fx.lowHpAtk&&bt.pHp<bt.pMax*fx.lowHpAtk.below/100)atk=Math.round(atk*(1+fx.lowHpAtk.bonus/100));
  if(fx.burst&&(t-(bt.burstStart[a]||1))<fx.burst.turns)atk=Math.round(atk*fx.burst.mult);
  if(fx.transform)atk=Math.round(atk*fx.transform.mult);
  if(bt.snatchAtk&&bt.snatchAtk[a])atk+=bt.snatchAtk[a];
  if(bt.shadow)atk=bt.shadow.atk;
  let dmgMult=1;
  if(fx.dmgMult)dmgMult*=fx.dmgMult;
  /* OPENING HIT: serangan pertama ke kartu musuh BARU ×(1+pct%) — guard dibuang saat percobaan pertama (miss/evade tetap habis) */
  /* DODGE-NEXT (TITAN HUNTER nextOnly): bonus damage dari dodge dipakai di serangan ini (sekali pakai) */
  if(fx.dodgeAtk&&fx.dodgeAtk.nextOnly){bt.dodgeNext=bt.dodgeNext||new Array(bt.fighters.length).fill(0);if((bt.dodgeNext[a]||0)>0){dmgMult*=1+bt.dodgeNext[a]/100;bt.dodgeNext[a]=0;setTimeout(()=>floatText(".fighter.me","COUNTER DODGE +"+fx.dodgeAtk.pct+"%","crit"),bsMs(150));}}
  if(fx.openingHit&&bt.openGuard&&bt.eHp>0){dmgMult*=(1+fx.openingHit.pct/100);bt.openGuard=false;}
  /* DESPERATE STRIKE dilepas: ×mult sekali lalu state=2 -> mati di awal enemyPhase (lihat blok dsState) */
  if(fx.desperateStrike&&bt.dsState[a]===1){dmgMult*=fx.desperateStrike.mult;bt.dsState[a]=2;setTimeout(()=>floatText(".fighter.me",fx.desperateStrike.text||"DESPERATE STRIKE","crit"),bsMs(200));}
  /* SLEEP STRIKE dilepas: serangan pertama setelah bangun ×mult sekali; overkill disimpan di bt.overflow (dihantamkan ke musuh berikutnya di advanceTowerFoe) */
  let sleepHit=false;
  if(fx.sleepStrike&&bt.sleepArmed[a]){sleepHit=true;dmgMult*=fx.sleepStrike.mult;bt.sleepArmed[a]=false;setTimeout(()=>floatText(".fighter.me",fx.sleepStrike.text||"THUNDERCLAP FLASH","crit"),bsMs(220));}
    /* SERIOUS PUNCH dilepas: giliran ke-charge -> xmult + arm shockwave 10% (dipakai di blok hits) */
  if(fx.seriousPunch&&bt.spArmed[a]){bt.spArmed[a]=false;dmgMult*=fx.seriousPunch.mult;setTimeout(()=>floatText(".fighter.me","SERIOUS PUNCH","crit"),bsMs(200));}
  /* FREEZE (10TH CAPTAIN): selama target BEKU (bt.freezeLeft>0, tick paralel eStun di enemyPhase) serangan kartu ini ×mult */
  if(fx.entryFreeze&&(bt.freezeLeft||0)>0)dmgMult*=fx.entryFreeze.mult;
  /* FREEZE BONUS (ICE QUEEN): selama target BEKU, serangan kartu ini xmult */
  if(fx.hitFreeze&&(bt.freezeLeft||0)>0)dmgMult*=fx.hitFreeze.mult;
   /* MASTERPIECE (HEIGHT OF PAINTING): serangan ke-3 -> xmult + arm stun (dilepas setelah hit, guard statusImmune) */
   let masterpiece=false;
   if(fx.valhalla&&fx.valhalla.master){bt.paintHits[a]=(bt.paintHits[a]||0)+1;if(bt.paintHits[a]%3===0){masterpiece=true;dmgMult*=fx.valhalla.master.mult;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MASTERPIECE!","crit");},bsMs(220));}}
  /* BERSERKER ARMOR aktif (THE STRUGGLER): serangan xatkMult */
  /* DIZZY (RUBBER FIELD): penyerang kena DIZZY -> semua damage yang diterima +20% per stack */
  if((bt.dizzyStack||0)>0&&(bt.dizzyLeft||0)>0)dmgMult*=(1+bt.dizzyStack*0.2);
  if(fx.berserker&&bt.berserkOn&&(bt.berserkLeft||0)>0)dmgMult*=fx.berserker.atkMult;
  /* SATU PERSEN (Ultra Instinct): tiap serangan GENAP (ke-2, ke-4, ...) = 1% kekuatan penuh → ×mult damage + tembus damage reduction musuh */
  let pen=!!fx.ignoreDef;
  if(fx.everySecond){bt.atkCount[a]++;if(bt.atkCount[a]%2===0){dmgMult*=fx.everySecond.mult;pen=true;setTimeout(()=>floatText(".fighter.me","ONE PERCENT","crit"),bsMs(220));}}
  /* SUSANOO CHIDORI: tiap serangan ke-N → ×mult damage + menembus pengurangan damage */
  if(fx.everyNth){bt.atkCount[a]++;if(bt.atkCount[a]%fx.everyNth.n===0){dmgMult*=fx.everyNth.mult;pen=true;setTimeout(()=>floatText(".fighter.me",fx.everyNth.text||"SUSANOO CHIDORI","crit"),bsMs(220));}}if(fx.everyNth.next&&bt.atkCount[a]>0&&bt.atkCount[a]%fx.everyNth.n===0&&bt.eHp>0){const nd=Math.max(1,Math.round(atk*(fx.everyNth.next/100)));if(fx.everyNth.all&&bt.tower&&towerRun){lineupAoeHit(nd);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","GAMMA RAY -"+fmt(nd),"crit");},bsMs(420));}else if(!fx.everyNth.all&&bt.tower&&towerRun){lineupNextHit(nd);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","DEATH BEAM -"+fmt(nd),"crit");},bsMs(420));}}
  /* THE WORLD (Immortal Vampire): serangan ke-`every` -> stun musuh `turns` giliran lagi (entry stun sudah arming di 4 titik masuk) */
  if(fx.timeStop){bt.atkCount[a]++;if(bt.atkCount[a]%fx.timeStop.every===0&&!foeStatusImmune()){bt.eStun=fx.timeStop.turns;setTimeout(()=>floatText(".fighter.foe","THE WORLD","crit"),bsMs(220));}}
  /* 40-DAY FLOOD (Sea Sovereign): serangan ke-`every` -> ×mult + tembus DR + eksekusi kalau musuh <= exec% HP */
  let floodHit=false;
  if(fx.flood){bt.atkCount[a]++;if(bt.atkCount[a]%fx.flood.every===0){floodHit=true;dmgMult*=fx.flood.mult;pen=true;setTimeout(()=>floatText(".fighter.foe",(fx.flood.label||"40-DAY FLOOD"),"crit"),bsMs(220));}}
/* SAND BURIAL (Sand Vessel): serangan ke-`every` -> guaranteed hit xmult, bypass dodge/void via tsLock */
let sandHit=false;
if(fx.sandBurial){bt.atkCount[a]++;if(bt.atkCount[a]%fx.sandBurial.every===0){sandHit=true;dmgMult*=fx.sandBurial.mult;setTimeout(()=>floatText(".fighter.foe","SAND BURIAL","crit"),bsMs(220));}}
  /* STYLE SWITCHING (Devil Hunter): 4 mode bergilir tiap giliran kartu ini menyerang */
  if(fx.styleSwitching){
    const STYLES=["TRICKSTER","SWORDMASTER","ROYALGUARD","GUNSLINGER"];
    const si=bt.styleCount[a]%4;bt.styleCount[a]++;
    setTimeout(()=>floatText(".fighter.me",STYLES[si],"crit"),bsMs(120));
    if(si===0)bt.trickNext=true;
    else if(si===1)dmgMult*=1.5;
    else if(si===2)bt.royalNow=true;
    else if(si===3)bt.gunsNow=true;
  }
  if(fx.highHpDmg&&bt.pHp>bt.pMax*fx.highHpDmg.above/100)dmgMult*=(1+fx.highHpDmg.bonus/100);
  if(fx.grieferAtk)dmgMult*=fx.grieferAtk.mult;
  if(fx.turret&&bt.turret>0)dmgMult*=(1+bt.turret*fx.turret.atkPct/100);
  /* SENZU MUNCH (DUMB HAIR GUY): heal tiap giliran; makan -> x0.5 dmg; finish meal tiap N giliran -> x4 strike */
  if(fx.senzu){
    const sl=fx.senzu;
    bt.senzu.turn++;
    const fin=(bt.senzu.turn%sl.every===0);
    const heal=Math.round(bt.pMax*sl.healPct/100);
    bt.pHp=Math.min(bt.pMax,bt.pHp+heal);
    dmgMult*=fin?sl.strikeMult:sl.eatMult;
    bt.senzuFin=fin;
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me",fin?"FINISH THE MEAL!":"MUNCH MUNCH +"+heal,"heal");},bsMs(300));
  }
  /* GOMU GOMU (DUMB STRETCHY GUY): tiap serangan trigger random 1 dari 3 */
  if(fx.stretch){
    const st=fx.stretch;const r=Math.floor(Math.random()*3);
    if(r===0){bt.balloon=st.balloon.reflect;dmgMult=0;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GUM-GUM BALLOON!","heal");},bsMs(300));}
    else if(r===1){dmgMult=0;bt.stretchShot=Math.round(cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk*st.fireworks.mult);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GUM-GUM FIREWORKS!","crit");},bsMs(300));}
    else{dmgMult=0;const fh=Math.round(bt.pMax*st.flop.healPct/100);bt.pHp=Math.min(bt.pMax,bt.pHp+fh);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GUM-GUM FLOP +"+fh,"heal");},bsMs(300));}
  }
  /* BUNGEE GUM: selama gum masih nempel di musuh (ditempel waktu musuh nyerang), serangan ×(1+bonus%) lalu hitung mundur */
  if(fx.bungeeGum&&bt.gumTurns>0){dmgMult*=(1+fx.bungeeGum.bonus/100);bt.gumTurns--;}
  const hits=[{mult:1}];

  /* THE WORLD ENDER (DARKIN LORD): cycle 3 serangan - 150% / 40% semua / 80% pierce + 80% di belakang */

  let weExtra=0;

  if(fx.worldEnder){

    const we=fx.worldEnder;const ph=bt.weCount[a]%3;bt.weCount[a]++;

    hits.length=0;

    if(ph===0){hits.push({mult:we.cyc1});}

    else if(ph===1){hits.push({mult:we.cyc2});weExtra=Math.round(atk*dmgMult*we.cyc2);lineupAoeHit(weExtra);}

    else{hits.push({mult:we.pierce});weExtra=Math.round(atk*dmgMult*we.pierce);lineupNextHit(weExtra);}

    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me",ph===0?"WORLD ENDER":ph===1?"WORLD ENDER - ALL":"WORLD ENDER - PIERCE","crit");},bsMs(240));

  }

  /* PSYCHIC BARRAGE (PSYCHIC ESPER): alih-alih menyerang - N batu acak ke musuh aktif / cadangan tower */

  if(fx.psychicBarrage){

    const pb=fx.psychicBarrage;const n=bt.pbRocks||pb.rocks;

    hits.length=0;

    let railDirty=false;

    for(let i=0;i<n;i++){

      let target=null;

      if(bt.tower&&towerRun){

        const alive=[];

        for(let j=towerRun.idx+1;j<towerRun.waves.length;j++){const w=towerRun.waves[j];if(w&&!w.dead)alive.push(w);}

        if(alive.length&&Math.random()<0.5)target=alive[Math.floor(Math.random()*alive.length)];

      }

      const key=target?("W"+towerRun.waves.indexOf(target)):"A";

      if(key===bt.pbKey)bt.pbStreak++;else bt.pbStreak=0;

      bt.pbKey=key;

      const m=pb.mult*(1+bt.pbStreak*(pb.streakPct||10)/100);

      if(target){

        if(target.hp==null)target.hp=target.es.hp;

        const d=Math.round(atk*dmgMult*m);

        target.hp-=d;

        if(target.hp<=0){target.hp=0;target.dead=true;}

        railDirty=true;

      }else{

        hits.push({mult:m});

      }

    }

    if(!hits.length)hits.push({mult:0});

    if(railDirty){const rail=document.querySelector(".foe-rail");if(rail)rail.outerHTML=towerEnemyBenchRail();}

    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","PSYCHIC BARRAGE x"+n,"crit");},bsMs(300));

  }
  if(fx.seriousPunch&&bt.spWave[a]){bt.spWave[a]=false;hits.push({mult:(fx.seriousPunch.wavePct||10)/100});lineupAoeHit(Math.round(atk*dmgMult*((fx.seriousPunch.wavePct||10)/100)));}
  if(fx.tripleHit){hits.length=0;for(let tri=0;tri<fx.tripleHit.hits;tri++)hits.push({mult:fx.tripleHit.mult});}
  if(typeof fx.double==="object"){if(Math.random()*100<(fx.double.chance!=null?fx.double.chance:100))hits.push({mult:(fx.double.pct!=null?fx.double.pct:100)/100});}else if(fx.double&&Math.random()*100<fx.double)hits.push({mult:1});
  let crit=false;
  if(fx.crit&&Math.random()*100<fx.crit.chance){crit=true;hits[hits.length-1].mult*=fx.crit.mult;}
  else if(Math.random()*100<BASE_CRIT.chance){crit=true;hits[hits.length-1].mult*=BASE_CRIT.mult;}
  let purple=false;
  if(fx.purple&&Math.random()*100<fx.purple.chance){purple=true;crit=true;hits[hits.length-1].mult*=fx.purple.mult;}
  let ranton=false;
  if(fx.ranton&&Math.random()*100<fx.ranton.chance){ranton=true;crit=true;hits.length=0;const rh=Math.max(1,fx.ranton.hits||5),rm=fx.ranton.mult||1;for(let k=0;k<rh;k++)hits.push({mult:rm});}
  let barrageN=0,iceBlastN=0;
  if(fx.barrage&&Math.random()*100<fx.barrage.chance){const n=fx.barrage.min+Math.floor(Math.random()*(fx.barrage.max-fx.barrage.min+1));const bm=fx.barrage.mult||1;if(bm!==1){hits.length=0;for(let i=0;i<n;i++)hits.push({mult:bm});}else{while(hits.length<n)hits.push({mult:1});}barrageN=hits.length;}
  if(ranton&&!barrageN)barrageN=hits.length;
  /* ICE BLAST (kartu BOSS): chance% -> ganti hit jadi N tembakan @ pct% ATK, label float di performAttack */
  if(fx.iceBlast&&Math.random()*100<fx.iceBlast.chance){const n=Math.max(1,fx.iceBlast.hits||3),pm=(fx.iceBlast.pct!=null?fx.iceBlast.pct:100)/100;hits.length=0;for(let i=0;i<n;i++)hits.push({mult:pm});iceBlastN=n;barrageN=n;}
  // DOMAIN EXPANSION (Gojo, disamakan dengan Shrine Sukuna): 100% tiap ronde → 15 sambaran @30% ATK + lifesteal + recharge (stun 1 & DR 50% 2 ronde)
  let domainStrike=false;
  if(fx.domain&&id==="CH_EX_GOJO"&&Math.random()*100<(fx.domain.chance||100)){const dn=fx.domain.min||10,dm=(fx.domain.mult!=null?fx.domain.mult:0.3);hits.length=0;for(let i=0;i<dn;i++)hits.push({mult:dm});barrageN=dn;crit=false;purple=false;ranton=false;domainStrike=true;}
  bt.domainNow=domainStrike;
  /* Galaxy Roar = SATU semburan: semua damage ditumpuk ke satu sambaran supaya laser & ledakannya sinkron */
  const galaxy=id==="CH_ETERNAL_DRAGON"&&purple;
  if(galaxy){const m=hits[hits.length-1].mult;hits.length=0;hits.push({mult:m});barrageN=0;}
  const ariseMode=id==="CH_EX_JINWOO"&&barrageN>=9;
  if(bt.gunsNow)hits.push({mult:0.4});
/* THE WORLD: selama time stop aktif serangan tidak bisa di-dodge/void */
  let tsLock=!!(fx.timeStop&&(bt.eStun||0)>0)||!!sandHit;
    let total=0;const shots=[];
  hits.forEach(h=>{
    let d=Math.round(atk*dmgMult*h.mult);
    if(!pen&&!tsLock&&efx.evasion&&t<=efx.evasion.turns&&Math.random()*100<efx.evasion.chance){shots.push({d:0,evade:true});return;}
    const pierce=!!(fx.pierce&&Math.random()*100<fx.pierce);
    if(!pen&&!tsLock&&efx.void&&!pierce&&Math.random()*100<efx.void){shots.push({d:0,void:true});return;}
    shots.push({d,miss:false,pierce});total+=d;
  });
if(floodHit&&total>0&&total<bt.eHp&&((fx.flood.exec!=null?fx.flood.exec:20)>0)&&bt.eHp<=bt.es.hp*((fx.flood.exec!=null?fx.flood.exec:20)/100))total=bt.eHp;
/* HITOKUGUTSU (Puppeteer): tiap hit -> puppet poison -pct% ATK musuh permanen (stacking s/d 90%) */
if(fx.puppetPoison&&total>0){bt.ePoison=Math.min(90,(bt.ePoison||0)+fx.puppetPoison.pct);setTimeout(()=>floatText(".fighter.foe","PUPPET -"+fx.puppetPoison.pct+"% ATK","burn"),bsMs(360));}
if(fx.inkCorrupt&&total>0){bt.eInk=Math.min(fx.inkCorrupt.max,(bt.eInk||0)+1);bt.eInkPct=fx.inkCorrupt.pct;setTimeout(()=>floatText(".fighter.foe","INK CORRUPTION","burn"),bsMs(380));}
    const eHpNext=bt.eHp-total,foeDead=eHpNext<=0;
  /* THUNDERCLAP FLASH overflow: sisa damage serangan sleepStrike yang membunuh target disimpan buat musuh berikutnya */
  if(sleepHit&&foeDead&&eHpNext<0)bt.overflow=-eHpNext;
  const _fgFoe=(bt.fgen||0);const foeDownCb=()=>{if(bt&&!bt.over&&(bt.fgen||0)===_fgFoe)foeDown();};
  performAttack({
    A:".fighter.me",D:".fighter.foe",id,fx,
    barId:"hpFoe",barTid:"hpFoeT",defMax:bt.es.hp,
    defHpStart:bt.eHp+total,defHpEnd:eHpNext,
    shots,total,crit,purple,
    ranton,domainStrike,ariseMode,barrageN,galaxy,iceBlast:!!iceBlastN,
    onAnimEnd:foeDead?foeDownCb:null,
    recharge:(b)=>{if(!bt)return;bt.pStun=(fx&&fx.statusImmune)?0:b.selfStun;bt.pDrTurns=b.selfDrTurns||b.selfStun;bt.pDr=b.selfDr||0;setTimeout(()=>floatText(".fighter.me","RECHARGE","miss"),bsMs(1200));}
  });
  bt.eHp=eHpNext;
  if(ranton&&total>0&&bt.eHp>0&&fx.ranton.stun){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else bt.eStun=fx.ranton.stun;}
   if(masterpiece&&bt.eHp>0&&fx.valhalla.master.stun){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else{bt.eStun=Math.max(bt.eStun||0,fx.valhalla.master.stun);setTimeout(()=>floatText(".fighter.foe","MASTERPIECE STUN","crit"),bsMs(520));}}
  /* HP DRAIN: tiap serangan yang kena memotong MAX HP musuh secara permanen (compounding) */
  if(fx.hpDrain&&total>0&&bt.eHp>0&&!foeStatusImmune()){
    bt.es.hp=Math.max(1,Math.round(bt.es.hp*(1-fx.hpDrain.pct/100)));
    if(bt.eHp>bt.es.hp)bt.eHp=bt.es.hp;
    setTimeout(()=>floatText(".fighter.foe","HP DRAIN","crit"),bsMs(360));
  }
    /* THE WORLD ENDER lifesteal: heal healPct% dari semua damage giliran ini (x1.3 setelah revive) */

  if(fx.worldEnder&&total+weExtra>0){

    const wh=Math.max(1,Math.round((total+weExtra)*fx.worldEnder.healPct/100*(bt.weRevived?1.3:1)));

    bt.pHp=Math.min(bt.pMax,bt.pHp+wh);

    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","LIFESTEAL +"+fmt(wh),"heal");},bsMs(460));

  }

  /* WALL TITANS: tiap `every` giliran, berbaris ngasih bonus pct% ATK ke musuh (di luar serangan normal) */
  if(fx.wallTitans){bt.wtCount[a]=(bt.wtCount[a]||0)+1;if(bt.wtCount[a]%fx.wallTitans.every===0&&bt.eHp>0){const wt=Math.round(atk*fx.wallTitans.pct/100);bt.eHp-=wt;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","WALL TITANS -"+fmt(wt),"crit");}},bsMs(520));}}
  /* SHOCKWAVE (OCEAN'S GUARDIAN): setiap serangan ke-`every`, kartu aktif musuh kena flat pct% ATK di luar serangan normal (gaya wallTitans; arena 1 musuh aktif = "semua musuh" jatuh ke kartu aktif) */
  if(fx.shockwave){bt.shockCount[a]=(bt.shockCount[a]||0)+1;if(bt.shockCount[a]%fx.shockwave.every===0&&bt.eHp>0){const sw=Math.round(atk*fx.shockwave.pct/100);bt.eHp-=sw;lineupAoeHit(sw);setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","SHOCKWAVE -"+fmt(sw),"crit");}},bsMs(560));}}
  /* SUPER MEGA DEATH ROCKET (HAVOC WREACKER): serangan ke-`every` -> flat pct% ATK ke musuh aktif + seluruh slot cadangan (lineupAoeHit) */
  if(fx.havocRocket){bt.hvCount[a]=(bt.hvCount[a]||0)+1;if(bt.hvCount[a]%fx.havocRocket.every===0&&bt.eHp>0){const rk=Math.round(atk*fx.havocRocket.pct/100);bt.eHp-=rk;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","DEATH ROCKET -"+fmt(rk),"crit");}},bsMs(560));lineupAoeHit(rk);}}  if(fx.lifesteal&&total>0){
    const ls=Math.round(total*fx.lifesteal/100);bt.pHp=Math.min(bt.pMax,bt.pHp+ls);
    setTimeout(()=>floatText(".fighter.me","+"+fmt(ls),"heal"),bsMs(300));
  }
   /* INK DRAIN (INK ANAMLOY): serangan ke-every -> heal pct% dari damage yang DIBERIKAN serangan itu */
   if(fx.inkDrain&&total>0){bt.paintHits[a]=(bt.paintHits[a]||0)+1;if(bt.paintHits[a]%fx.inkDrain.every===0){const ih=Math.max(1,Math.round(total*fx.inkDrain.pct/100));bt.pHp=Math.min(bt.pMax,bt.pHp+ih);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","INK DRAIN +"+fmt(ih),"heal");},bsMs(320));}}
  if(fx.burn&&total>0&&Math.random()*100<fx.burn.chance){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else{bt.eBurn=fx.burn.turns;setTimeout(()=>floatText(".fighter.foe","BURN","burn"),bsMs(360));}}
  /* HIT FREEZE (ICE QUEEN): chance% per serangan -> bekukan musuh turns giliran (pola burn, guard statusImmune) */
  /* SENZU FINISH MEAL (DUMB HAIR GUY): gain 25% damage sbg flat ATK + 50% sbg max HP, cap maxMultx base */
  if(fx.senzu&&bt.senzuFin&&total>0&&bt.eHp>0){
    const sl=fx.senzu;
    let gA=Math.round(total*sl.atkGain/100);let gH=Math.round(total*sl.hpGain/100);
    gA=Math.max(0,Math.min(gA,bt.senzu.baseAtk*(sl.maxMult-1)-bt.senzu.atkSum));
    gH=Math.max(0,Math.min(gH,bt.senzu.baseHp*(sl.maxMult-1)-bt.senzu.hpSum));
    if(gA>0){bt.senzu.atkSum+=gA;bt.atkBuff[a]+=Math.round(gA/bt.senzu.baseAtk*100);}
    if(gH>0){bt.senzu.hpSum+=gH;bt.pMax=Math.round(bt.senzu.baseHp+bt.senzu.hpSum);if(bt.pHp>bt.pMax)bt.pHp=bt.pMax;}
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","SENZU GROW +ATK +MAX HP","crit");},bsMs(360));
  }
  if(fx.senzu)bt.senzuFin=false;
  /* FIREWORKS (DUMB STRETCHY GUY): pukulan ekstra xmult ATK dasar ke musuh */
  if(bt.stretchShot){
    const fd=bt.stretchShot;bt.stretchShot=0;
    if(bt.eHp>0){
      bt.eHp-=fd;
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","FIREWORKS -"+fmt(fd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(340));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
    }
  }
  /* MAX CORRUPT (GLITCHED ENTITY): serangan kena -> max HP musuh turun pct% permanen, clamp eHp */
  if(fx.maxCorrupt&&total>0&&bt.eHp>0){
    bt.es.hp=Math.max(1,Math.round(bt.es.hp*(100-fx.maxCorrupt.pct)/100));
    if(bt.eHp>bt.es.hp)bt.eHp=bt.es.hp;
    setTimeout(()=>{if(bt&&!bt.over){floatText(".fighter.foe","MAX HP CORRUPT","burn");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(340));
  }
  if(fx.hitFreeze&&total>0&&bt.eHp>0&&Math.random()*100<fx.hitFreeze.chance){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else{bt.eStun=fx.hitFreeze.turns;bt.freezeLeft=fx.hitFreeze.turns;setTimeout(()=>floatText(".fighter.foe","BEKU","crit"),bsMs(360));}}
  /* PERFECT SUSANOO (low HP): di bawah ambang, serangan membakar musuh selama N giliran */
  if(fx.lowHpAura&&total>0&&bt.pHp<bt.pMax*fx.lowHpAura.below/100&&bt.eHp>0){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else{if(fx.lowHpAura.burn)bt.eBurn=fx.lowHpAura.burn.turns;setTimeout(()=>floatText(".fighter.foe","PERFECT SUSANOO","burn"),bsMs(360));}}
  /* STUN PUNCH (LUCK VOLTIA): counter tiap serangan kena; serangan ke-every -> roll stun + atkBuff permanen */
  if(fx.stunPunch&&total>0&&bt.eHp>0){
    bt.punchCount=bt.punchCount||new Array(bt.fighters.length).fill(0);bt.stunGain=bt.stunGain||new Array(bt.fighters.length).fill(0);
    bt.punchCount[a]=(bt.punchCount[a]||0)+1;
    if(bt.punchCount[a]%fx.stunPunch.every===0&&Math.random()*100<fx.stunPunch.chance&&!foeStatusImmune()){
      bt.eStun=Math.max(bt.eStun||0,fx.stunPunch.turns);
      if(bt.stunGain[a]<(fx.stunPunch.max||5)){bt.stunGain[a]++;bt.atkBuff[a]+=fx.stunPunch.atkPct;}
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","STUN! +"+fx.stunPunch.atkPct+"% ATK","crit");},bsMs(360));
    }
  }
  /* EIGHT GATES (GREEN BEAST): gerbang tiap kena -> atkBuff; gerbang penuh -> rugi selfPct% max HP (mati via gateKill) */
  if(fx.eightGates&&total>0&&bt.eHp>0&&bt.pHp>0){
    bt.gateCount=bt.gateCount||new Array(bt.fighters.length).fill(0);
    if(bt.gateCount[a]<fx.eightGates.max){bt.gateCount[a]++;bt.atkBuff[a]+=fx.eightGates.atkPct;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GERBANG "+bt.gateCount[a]+"/"+fx.eightGates.max+" +"+fx.eightGates.atkPct+"%","crit");},bsMs(380));}
    if(bt.gateCount[a]>=fx.eightGates.max){
      const gd=Math.max(1,Math.round(bt.pMax*fx.eightGates.selfPct/100));bt.pHp=Math.max(0,bt.pHp-gd);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","HARGA GERBANG -"+fmt(gd),"burn");setBar("hpMe","hpMeT",bt.pHp,bt.pMax);}},bsMs(440));
      if(bt.pHp<=0)bt.gateKill=true;
    }
  }
  /* SHOCK ALL (TREMOR EMPEROR): shockwave flat pct% ATK ke seluruh lineup musuh / aktif (story) */
  if(fx.shockAll&&total>0&&bt.eHp>0){
    const sd=Math.max(1,Math.round(atk*fx.shockAll.pct/100));
    if(bt.tower&&towerRun){lineupAoeHit(sd);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","GEMPA -"+fmt(sd),"crit");},bsMs(460));}
    else{bt.eHp-=sd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","GEMPA -"+fmt(sd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(460));}
  }
  /* SPLASH (LIGHTBORNE ADMIRAL): tembusan flat pct% ATK ke lineup BERIKUTNYA / aktif lagi (story) */
  if(fx.splash&&total>0&&bt.eHp>0){
    const pd=Math.max(1,Math.round(atk*fx.splash.pct/100));
    if(bt.tower&&towerRun){lineupNextHit(pd);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","YASAKANI -"+fmt(pd),"crit");},bsMs(500));}
    else{bt.eHp-=pd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","YASAKANI -"+fmt(pd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(500));}
  }
  setBar("hpFoe","hpFoeT",bt.eHp+total,bt.es.hp);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
  /* STATUS IMMUNE: burn musuh dibatalkan tanpa tick damage */
  if(bt.eBurn>0&&foeStatusImmune()){bt.eBurn=0;setTimeout(()=>floatText(".fighter.foe","IMMUNE · BURN","heal"),bsMs(300));}
  if(bt.eBurn>0&&bt.eHp>0){
    const bPct=fx.burn?fx.burn.pct:(fx.lowHpAura&&fx.lowHpAura.burn?fx.lowHpAura.burn.pct:0);
    const bd=Math.round(bt.es.hp*bPct/100);bt.eHp-=bd;bt.eBurn--;
    setTimeout(()=>{anim(".fighter.foe","hit");floatText(".fighter.foe","-"+fmt(bd),"burn");},bsMs(420));
  }
  if(bt.eHp<=0){
    // mati karena racun (bukan karena sambaran yang sudah dijadwalkan onAnimEnd)
    if(!foeDead)setTimeout(foeDownCb,bsMs(620));
    return;
  }
  schedPhase(galaxy?GALAXY.total+160:ariseMode?2200:domainStrike?1700:ranton?MADARA_T.total+160:1000,enemyPhase);
}
function enemyPhase(){
  if(!bt||bt.over)return;
  bt.foeDowning=false;/* kill berikutnya baru sah setelah giliran ini mulai */
  /* DEATH DEFY selesai: kartu sudah dapat giliran ekstranya (menyerang) -> tumbang sekarang,
     sebelum musuh sempat menyerang balik. Pola penutup = deathStep (turn++ / trySave / playerPhase). */
  if(bt.defyHold){
    bt.defyHold=false;bt.pHp=0;
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","ko");floatText(".fighter.me","ASHURA FADES","crit");}},bsMs(150));
    setTimeout(()=>{
      if(!bt||bt.over)return;
      bt.turn++;
      if(!trySave()){endBattle(false);return;}
      schedPhase(bt.justTagged?2700:700,playerPhase);
    },bsMs(900));
    return;
  }
  /* DESPERATE STRIKE tuntas: serangan pamungkas sudah dilepaskan -> mati di akhir giliran (trySave normal) */
  if(bt.dsState&&bt.dsState[bt.active]===2){
    bt.dsState[bt.active]=0;
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","ko");floatText(".fighter.me","LAST GASP","crit");}},bsMs(150));
    setTimeout(()=>{
      if(!bt||bt.over)return;
      bt.turn++;
      if(!trySave()){endBattle(false);return;}
      schedPhase(bt.justTagged?2700:700,playerPhase);
    },bsMs(900));
    return;
  }
  /* EIGHT GATES harga: kartu tumbang di akhir giliran dia (pola dsState) */
  if(bt.gateKill){
    bt.gateKill=false;bt.pHp=0;
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","ko");floatText(".fighter.me","GERBANG PENUH...","crit");}},bsMs(150));
    setTimeout(()=>{
      if(!bt||bt.over)return;bt.turn++;
      if(!trySave()){endBattle(false);return;}
      schedPhase(bt.justTagged?2700:700,playerPhase);
    },bsMs(900));
    return;
  }
  setTurnPill("foe","GILIRAN MUSUH");
  if(bt.dizzyLeft>0){bt.dizzyLeft--;if(bt.dizzyLeft<=0){bt.dizzyStack=0;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","DIZZY HABIS","miss");},bsMs(300));}}
  const id=bt.eq.char,t=bt.turn;let fx=resolveFx(bt.eq,bt.efx);
  if(bt.shadow)fx={};
  const efx=(bt.eAbilityOff>0)?{}:(bt.efx||{});
  let eDomain=false,eArise=false,eranton=false,eGalaxy=false,eIceBlast=false;
  /* FREEZE tick (10TH CAPTAIN): hitungan beku turun tiap giliran musuh — paralel dgn eStun, sebelum blok stun biar bonus ×mult habis pas 2 giliran */
  if(bt.freezeLeft>0)bt.freezeLeft--;
  if(bt.eAbilityOff>0)bt.eAbilityOff--;
  if(bt.copyLeft>0)bt.copyLeft--;
  if(bt.eStun>0){
    if(efx.statusImmune){
      /* STATUS IMMUNE: stun musuh dibatalkan — musuh tetap menyerang */
      bt.eStun=0;
      setTimeout(()=>floatText(".fighter.foe","IMMUNE · STUN","heal"),bsMs(200));
    }else{
      bt.eStun--;
      anim(".fighter.foe","hit",true);
      setTimeout(()=>floatText(".fighter.foe","STUNNED","crit"),bsMs(200));
      bt.turn++;
      schedPhase(1000,playerPhase);
      return;
    }
  }
  // DOMAIN aktif ronde ini (Gojo): damage musuh dikurangi 50%
  const domainOn = bt.domainNow;
  const pa=bt.active;
  const entryTrig=!!(fx.entryCounter&&bt.entryGuard[pa]);
  const dodgeTrig=!!(fx.dodgeEvery&&bt.dodgeArmed[pa]);
  const evade=!!(entryTrig||dodgeTrig||(fx.evasion&&t<=fx.evasion.turns&&Math.random()*100<fx.evasion.chance)||(fx.dodgeAtk&&Math.random()*100<fx.dodgeAtk.chance)||bt.trickNext);
  const eVoid=!!(efx.void&&Math.random()*100<efx.void);
  if(evade){
    if(entryTrig)bt.entryGuard[pa]=false;
    if(dodgeTrig)bt.dodgeArmed[pa]=false;
    /* ULTRA INSTINCT: tiap berhasil menghindar → +pct% ATK permanen, stack sampai max (khusus dodgeAtk; evasion biasa gak kepengaruh) */
    if(fx.dodgeAtk&&fx.dodgeAtk.nextOnly){bt.dodgeNext=bt.dodgeNext||new Array(bt.fighters.length).fill(0);bt.dodgeNext[bt.active]=(bt.dodgeNext[bt.active]||0)+fx.dodgeAtk.pct;}else if(fx.dodgeAtk&&bt.dodgeStack[bt.active]<fx.dodgeAtk.max){bt.dodgeStack[bt.active]++;bt.atkBuff[bt.active]+=fx.dodgeAtk.pct;setTimeout(()=>floatText(".fighter.me","+"+fx.dodgeAtk.pct+"% ATK","heal"),bsMs(420));}
    if(id==="CH_EX_MADARA"){
      anim(".fighter.foe","lunge-l");
      setTimeout(()=>floatText(".fighter.me","LIMBO","miss"),bsMs(220));
    }else{
      setTimeout(()=>{playDodge();floatText(".fighter.me",entryTrig?(fx.entryCounter.text||"AMENOTEJIKARA"):bt.trickNext?"TRICKSTER":"DODGE","miss");},bsMs(200));
    }
    /* AMENOTEJIKARA counter: balasan instan mult× ATK ke musuh (dilewati kalau mult 0 = klon murni menghindar) */
    if(entryTrig){
      const cAtk=Math.round(cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk*(1+(bt.atkBuff[pa]||0)/100)*(fx.entryCounter.mult||0));
      if(cAtk>0){
        bt.eHp-=cAtk;
        setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","COUNTER -"+fmt(cAtk),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(520));
        if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
      }
    }
  }else if(eVoid){
    anim(".fighter.foe","lunge-l");
    const vh=Math.round(bt.es.atk*efx.void/100*2);
    setTimeout(()=>floatText(".fighter.me","VOID","miss"),bsMs(200));
    if(bt.eHp>0){bt.eHp=Math.min(bt.es.hp,bt.eHp+vh);setTimeout(()=>floatText(".fighter.foe","+"+fmt(vh),"heal"),bsMs(420));setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);}
  }else{
    let eAtk=bt.es.atk,edmgMult=1;
if(bt.ePoison>0)eAtk=Math.max(1,Math.round(eAtk*(1-Math.min(90,bt.ePoison)/100)));
    if((bt.eInk||0)>0&&bt.eInkPct>0)eAtk=Math.max(1,Math.round(eAtk*(1-(bt.eInk*bt.eInkPct)/100)));
    if(efx.lowHpAtk&&bt.eHp<bt.es.hp*efx.lowHpAtk.below/100)eAtk=Math.round(eAtk*(1+efx.lowHpAtk.bonus/100));
    if(efx.dmgMult)edmgMult*=efx.dmgMult;
    if(efx.highHpDmg&&bt.eHp>bt.es.hp*efx.highHpDmg.above/100)edmgMult*=(1+efx.highHpDmg.bonus/100);
    const eHits=[{mult:1}];let ecrit=false,epurple=false,eBarrageN=0;
    if(typeof efx.double==="object"){if(Math.random()*100<(efx.double.chance!=null?efx.double.chance:100))eHits.push({mult:(efx.double.pct!=null?efx.double.pct:100)/100});}else if(efx.double&&Math.random()*100<efx.double)eHits.push({mult:1});
    if(efx.crit&&Math.random()*100<efx.crit.chance){ecrit=true;eHits[eHits.length-1].mult*=efx.crit.mult;}
    else if(Math.random()*100<BASE_CRIT.chance){ecrit=true;eHits[eHits.length-1].mult*=BASE_CRIT.mult;}
    if(efx.purple&&Math.random()*100<efx.purple.chance){epurple=true;ecrit=true;eHits[eHits.length-1].mult*=efx.purple.mult;}
    if(efx.ranton&&Math.random()*100<efx.ranton.chance){eranton=true;ecrit=true;eHits.length=0;const rh=Math.max(1,efx.ranton.hits||5),rm=efx.ranton.mult||1;for(let k=0;k<rh;k++)eHits.push({mult:rm});}
    if(efx.barrage&&Math.random()*100<efx.barrage.chance){const n=efx.barrage.min+Math.floor(Math.random()*(efx.barrage.max-efx.barrage.min+1));const bm=efx.barrage.mult||1;if(bm!==1){eHits.length=0;for(let i=0;i<n;i++)eHits.push({mult:bm});}else{while(eHits.length<n)eHits.push({mult:1});}eBarrageN=eHits.length;}
    if(eranton&&!eBarrageN)eBarrageN=eHits.length;
    /* ICE BLAST (kartu BOSS sebagai LAWAN): N tembakan @ pct% ATK */
    if(efx.iceBlast&&Math.random()*100<efx.iceBlast.chance){const n=Math.max(1,efx.iceBlast.hits||3),pm=(efx.iceBlast.pct!=null?efx.iceBlast.pct:100)/100;eHits.length=0;for(let i=0;i<n;i++)eHits.push({mult:pm});eIceBlast=true;eBarrageN=n;}
    if(efx.domain&&bt.eid==="CH_EX_GOJO"&&Math.random()*100<(efx.domain.chance||100)){const dn=efx.domain.min||10,dm=(efx.domain.mult!=null?efx.domain.mult:.3);eHits.length=0;for(let i=0;i<dn;i++)eHits.push({mult:dm});eBarrageN=dn;ecrit=false;epurple=false;eranton=false;eDomain=true;}
    eArise=bt.eid==="CH_EX_JINWOO"&&eBarrageN>=9;
    eGalaxy=bt.eid==="CH_ETERNAL_DRAGON"&&epurple;
    if(eGalaxy){const m=eHits[eHits.length-1].mult;eHits.length=0;eHits.push({mult:m});eBarrageN=0;}
    let etotal=0;const eShots=eHits.map(h=>{let d=Math.round(eAtk*edmgMult*h.mult);let drR=(bt.pDrTurns>0&&bt.pDr>0)?bt.pDr:0;if((bt.pGuardDr||0)>drR)drR=bt.pGuardDr;if(drR>0){d=Math.round(d*(1-drR/100));}etotal+=d;return{d};});
    /* ROYALGUARD: damage masuk dipangkas 50% (dibalas 30% di bawah) */
    if(bt.royalNow&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*0.5));etotal=eShots.reduce((x,s)=>x+s.d,0);}
    /* PERFECT SUSANOO (low HP): damage masuk dipangkas `dr`% */
    if(fx.lowHpAura&&bt.pHp<bt.pMax*fx.lowHpAura.below/100&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*(1-fx.lowHpAura.dr/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);setTimeout(()=>floatText(".fighter.me","PERFECT SUSANOO","heal"),bsMs(320));}
    /* PSYCHIC BLIZZARD (BLIZZARD BADDIE): barrier aktif -> pangkas damage `dr`% + heal `healPct`% max HP per serangan yang diredam; barrier habis setelah `left` giliran */
    if(bt.psychic&&bt.psychic.left>0&&etotal>0){
      eShots.forEach(s=>s.d=Math.round(s.d*(1-bt.psychic.dr/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);
      const bh=Math.max(1,Math.round(bt.pMax*bt.psychic.healPct/100));
      bt.pHp=Math.min(bt.pMax,bt.pHp+bh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","PSYCHIC BARRIER +"+fmt(bh),"heal");},bsMs(360));
      bt.psychic.left--;
      if(bt.psychic.left<=0)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","BARRIER HABIS","miss");},bsMs(520));
    }
    /* ICE SHELL (10TH CAPTAIN): selama kartu ini AKTIF di arena, damage masuk dipangkas `iceShell`% permanen (tanpa timer; hilang pas tag-out) */
    if(fx.iceShell&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*(1-fx.iceShell/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);}
   /* TWILIGHT OF VALHALLA (HEIGHT OF PAINTING): selama aktif, damage masuk dipangkas dmgCut% */
   if(fx.valhalla&&(bt.valhallaLeft||0)>0&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*(1-fx.valhalla.dmgCut/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);}
   /* INK WARD (INK ANAMLOY): selama kartu aktif, damage masuk dipangkas dmgCut% (pola iceShell) */
   if(fx.dmgCut&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*(1-fx.dmgCut.pct/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);}

    /* RUBBER FIELD (SUN GOD): serangan dipotong 50%, sisanya disimpan buat memantul balik + penyerang jadi DIZZY */

    bt.rbBounce=0;

    if(bt.rubber&&etotal>0){

      const full=etotal;

      eShots.forEach(s=>s.d=Math.round(s.d*0.5));etotal=eShots.reduce((x,s)=>x+s.d,0);

      bt.rbBounce=full-etotal;

      if(!foeStatusImmune()){bt.dizzyStack=(bt.dizzyStack||0)+1;bt.dizzyLeft=9;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","DIZZY x"+bt.dizzyStack,"burn");},bsMs(420));}

    }
    /* EVOLUTION TURRET (YORDLE INVENTOR): kena serangan -> chance% turret nahan semua damage, 1 turret hancur */
    if(fx.turret&&bt.turret>0&&etotal>0&&Math.random()*100<fx.turret.blockPct){
      etotal=0;eShots.forEach(s=>s.d=0);bt.turret--;
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TURRET BLOCK! sisa "+bt.turret,"crit");},bsMs(320));
    }    /* GUM-GUM BALLOON (DUMB STRETCHY GUY): reflect % dari hit musuh berikutnya (sekali pakai) */
    if(bt.balloon>0&&etotal>0){
      const rd=Math.max(1,Math.round(etotal*bt.balloon/100));
      bt.balloon=0;bt.eHp-=rd;
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","BALLOON -"+fmt(rd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(380));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));}
    }
    if(bt.pDrTurns>0&&bt.pDr>0){bt.pDrTurns--;setTimeout(()=>floatText(".fighter.me","DR aktif","heal"),bsMs(340));}
    /* BUNGEE GUM: tiap kali musuh KENA menempel ke Trickster (serangan masuk), tempel/renew gum 2 giliran */
    if(fx.bungeeGum&&etotal>0){bt.gumTurns=fx.bungeeGum.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","BUNGEE GUM","crit");},bsMs(300));}
    /* GODHAND CAUSALITY (WHITE HAWK): diserang & kena -> ability musuh dimatikan permanen */
    if(fx.stripAbility&&etotal>0){bt.eAbilityOff=999;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","GODHAND - ABILITY ERASED","crit");},bsMs(300));}
    const meStart=bt.pHp;
    bt.pHp-=etotal;
    if(fx.valhalla&&(bt.valhallaLeft||0)>0&&bt.pHp<1){bt.pHp=1;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT HOLD!","heal");},bsMs(300));}
    /* REVERSAL (TIME MASTER): serangan mematikan PERTAMA dibalik -> 1 HP (sekali) */
    if(fx.reversal&&bt.pHp<=0){bt.reversalUsed=bt.reversalUsed||new Array(bt.fighters.length).fill(false);if(!bt.reversalUsed[bt.active]){bt.reversalUsed[bt.active]=true;bt.pHp=1;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GOLD EXPERIENCE REQUIEM!","crit");},bsMs(400));}}
    /* CAUSALITY (ASTRAL DEVOURER): fatal -> balik ke HP awal giliran sebelumnya + atkBuff */
    if(fx.causality&&bt.pHp<=0){bt.causalUsed=bt.causalUsed||new Array(bt.fighters.length).fill(false);if(!bt.causalUsed[bt.active]){bt.causalUsed[bt.active]=true;bt.pHp=Math.max(1,bt.causalPrev||bt.pMax);bt.atkBuff[bt.active]+=fx.causality.atkPct;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","KAUSALITAS DIBALIK! +"+fx.causality.atkPct+"% ATK","crit");},bsMs(400));}}
    const pDead=bt.pHp<=0&&!(fx.berserker&&bt.berserkOn&&(bt.berserkLeft||0)>0);
    // kartu tumbang: tag-in / kalah BARU dijalankan setelah seluruh animasi sambaran musuh selesai
    const deathStep=()=>{
      if(!bt||bt.over)return;
      if(domainOn){bt.domainNow=false;}
      bt.turn++;
      /* DEATH STAY (TREMOR EMPEROR): fatal -> bertahan 1 giliran extra (masih menyerang), jatuh di awal enemyPhase berikutnya */
      if(fx.deathStay){bt.stayUsed=bt.stayUsed||new Array(bt.fighters.length).fill(false);if(!bt.stayUsed[bt.active]){bt.stayUsed[bt.active]=true;bt.defyHold=true;bt.pHp=1;setBar("hpMe","hpMeT",1,bt.pMax);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GURA GURA HOLD!","crit");},bsMs(400));schedPhase(1100,playerPhase);return;}}
      /* DEATH DEFY (THREEBLADE RONIN): fatal saat HP sebelum pukulan masih < pct% max
         -> TIDAK tumbang: bertahan di 0 HP, dapat 1 giliran ekstra (masih bisa menyerang),
         lalu jatuh di awal enemyPhase berikutnya. Sekali per battle. (fx={}=saat shadow -> gak trigger) */
      if(fx.deathDefy&&!bt.defyUsed[bt.active]&&meStart<bt.pMax*fx.deathDefy.pct/100){
        bt.defyUsed[bt.active]=true;bt.defyHold=true;bt.pHp=0;
        setBar("hpMe","hpMeT",0,bt.pMax);
        setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","ASHURA STANDS","crit");},bsMs(400));
        schedPhase(1100,playerPhase);
        return;
      }
      if(!trySave()){endBattle(false);return;}
      schedPhase(bt.justTagged?2700:700,playerPhase);
    };
    performAttack({
      A:".fighter.foe",D:".fighter.me",id:bt.eid,fx:efx,
      barId:"hpMe",barTid:"hpMeT",defMax:bt.pMax,
      defHpStart:meStart,defHpEnd:Math.max(0,bt.pHp),
      shots:eShots,total:etotal,crit:ecrit,purple:epurple,
      ranton:eranton,domainStrike:eDomain,ariseMode:eArise,barrageN:eBarrageN,galaxy:eGalaxy,iceBlast:eIceBlast,
      onAnimEnd:pDead?deathStep:null,
      recharge:(b)=>{if(!bt)return;bt.eStun=b.selfStun;setTimeout(()=>floatText(".fighter.foe","RECHARGE","miss"),bsMs(1200));}
    });
    setBar("hpMe","hpMeT",meStart,bt.pMax);
    if(efx.lifesteal&&etotal>0&&bt.eHp>0){
      const lh=Math.round(etotal*efx.lifesteal/100);bt.eHp=Math.min(bt.es.hp,bt.eHp+lh);
      setTimeout(()=>floatText(".fighter.foe","+"+fmt(lh),"heal"),bsMs(280));
      setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
    }
    /* COUNTER HIT (DRAGON SIN base atk / BLOODMOON base foeMaxHp): kena serangan -> balas flat */
  if(fx.counterHit&&etotal>0&&bt.eHp>0&&Math.random()*100<fx.counterHit.chance){
    const cb=(fx.counterHit.base==="foeMaxHp")?bt.es.hp:cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk;
    const cd=Math.max(1,Math.round(cb*fx.counterHit.pct/100));
    bt.eHp-=cd;
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe",(fx.counterHit.base==="foeMaxHp"?"BLOOD IGNITE -":"FULL COUNTER -")+fmt(cd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(560));
    if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
  }
  /* ROYALGUARD counter: balas 30% dari damage yang baru diterima ke musuh */
    if(bt.royalNow&&!pDead&&etotal>0){
      const ctr=Math.round(etotal*0.3);bt.eHp-=ctr;
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","COUNTER -"+fmt(ctr),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(560));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
    }
        /* RUBBER FIELD bounce: separuh damage serangan musuh memantul balik ke penyerang */

    if(bt.rbBounce>0&&!pDead){

      const rb=bt.rbBounce;bt.rbBounce=0;

      bt.eHp-=rb;

      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","RUBBER -"+fmt(rb),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(560));

      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}

    }

    if(pDead)return;
  }
  /* WORLD CORRUPT (THE GRIEFER): counter giliran musuh; tiap every -> musuh self-hit + party +dmgUp% dmg */
  if(bt.wc&&bt.eHp>0&&bt.pHp>0){
    bt.wc.c++;
    if(bt.wc.c%bt.wc.every===0){
      const wd=Math.max(1,Math.round(bt.wc.atk*bt.wc.pct/100));
      bt.eHp-=wd;
      for(let i=0;i<bt.fighters.length;i++)bt.atkBuff[i]=(bt.atkBuff[i]||0)+bt.wc.dmgUp;
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","GLITCH! -"+fmt(wd),"crit");floatText(".fighter.me","+"+bt.wc.dmgUp+"% DMG","heal");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(500));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
    }
  }
  if(domainOn){bt.domainNow=false;}
  bt.turn++;
  schedPhase(bt.justTagged?2700:(eGalaxy?GALAXY.total+160:eArise?2200:eDomain?1700:eranton?MADARA_T.total+160:1000),playerPhase);
}
function endBattle(win){
  if(!bt||bt.over)return;
  if(bt.timer){clearTimeout(bt.timer);bt.timer=null;}
  bt.over=true;
  /* klimaks: kartu yang kalah beneran tumbang (dulu final death gak ada animasi mati sama sekali) */
  try{
    const deadEl=document.querySelector(win?".fighter.foe":".fighter.me");
    if(deadEl&&!deadEl.classList.contains("ko")){deadEl.classList.add("ko");koFx(deadEl);}
  }catch(e){console.error("endBattle fx error",e);}
  setTimeout(()=>{
    try{
      if(bt&&bt.tower){ towerEnd(win); }
      else if(bt){ finish(win); }
      /* bt keburu di-null tapi masih di tower battle → tetap tutup lewat towerEnd
         (null-safe utk bt) supaya pendingRolls cair, popup roll muncul & pemain balik hub. */
      else if(towerRun&&towerView==="battle"){ towerEnd(win); }
      else{ console.error("endBattle: no battle context, win="+win); }
    }catch(err){
      console.error("finish error",err);
      let recovered=false;
      try{ if(!win&&towerRun){ towerEnd(false); recovered=true; } }catch(e2){ console.error("towerEnd retry error",e2); }
      try{save();}catch(e){}
      if(recovered)return;
      bt=null;state.battle=null;render();
    }
  },bsMs(win?2000:950));
}
function finish(win){
  clearTimeout(bt.timer);bt.over=true;
  const lv=bt.lv,first=!diffProg()[state.diff][lv];
  const reward=win?(first?firstClearReward(lv):Math.round(firstClearReward(lv)*.2)):0;
  if(win){state.cleared[lv]=true;diffProg()[state.diff][lv]=true;state.coins+=reward;state.xp+=20;
    while(state.xp>=state.playerLv*1000){state.xp-=state.playerLv*1000;state.playerLv++;}
    fanfare();
  }else sfx.lose();
  state.history.unshift({char:bt.eq.char,tier:bt.eq.tier,enemy:bt.en.name+(bt.en.boss?", "+bt.en.epithet:""),boss:bt.en.boss,level:lv,result:win?"VICTORY":"DEFEAT"});
  state.history=state.history.slice(0,120);
  save();renderShell();
  const ov=document.getElementById("overlay");
  const ch=chapOf(lv),chDone=win&&chapClearedMode(ch,state.diff),nxtCh=CHAPTERS.find(c=>c.no===ch.no+1);
  document.getElementById("ov-eyebrow").textContent=chDone?"VICTORY · BAB "+ch.no+" SELESAI ("+diffOf().l+")":win?(first?"VICTORY · FIRST CLEAR":"VICTORY · REPLAY"):"DEFEAT";
  const ti=document.getElementById("ov-title");ti.textContent=win?"VICTORY":"DEFEAT";ti.className="ov-title disp"+(win?"":" lose");
  const rw=document.getElementById("ov-reward");rw.style.display=win?"inline-flex":"none";
  rw.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5h4.5a2 2 0 0 1 0 4H10a2 2 0 0 0 0 4h5"/></svg> +'+reward+' <small>COINS</small>';
  document.getElementById("ov-note").textContent=win?(first?"Reward first clear":"Reward replay 20%")+" · "+bt.turn+" turn":"Kartu kalah — upgrade atau ganti kartu aktif.";
  const nx=document.getElementById("ov-next");nx.style.display="";
  if(win&&lv<ch.to){
    nx.textContent="LEVEL "+(lv+1)+" →";
    nx.onclick=()=>{ov.classList.remove("show");state.battle={level:lv+1};render();};
  }else if(win&&nxtCh){
    nx.textContent="KEMBALI";
    nx.onclick=()=>{ov.classList.remove("show");state.battle=null;render();};
  }else{
    nx.textContent="SELESAI";
    nx.onclick=()=>{ov.classList.remove("show");state.battle=null;render();};
  }
  document.getElementById("ov-again").onclick=()=>{ov.classList.remove("show");state.battle={level:lv};render();};
  ov.classList.add("show");
}
document.getElementById("overlay").addEventListener("click",e=>{
  if(e.target.id!=="overlay")return;
  document.getElementById("overlay").classList.remove("show");
  if(bt&&bt.tower){stopBattleLoop();towerView="hub";render();return;}
  if(state.battle){state.battle=null;render();}
});
let towerLossAutoPending=false; /* auto-restart tower: nunggu popup roll ditutup (reset di stopTower/towerStartRun) */
function rollPopClosed(){ if(!towerLossAutoPending)return; towerLossAutoPending=false; if(state&&state.tower&&state.tower.auto){ try{ towerStartRun(); }catch(e){ console.error("tower auto-restart error",e); } } }
document.getElementById("rrClose").onclick=()=>{document.getElementById("rollResultPop").classList.remove("show");try{sfx.hit();}catch(e){}rollPopClosed();};
document.querySelector("#rollResultPop .rr-back").onclick=()=>{document.getElementById("rollResultPop").classList.remove("show");rollPopClosed();};

/* =============== TOWER (menara tanpa ujung) ===============
   Mode endless: lantai naik terus, tiap 5 lantai = gerbang BOS (2 gelombang: utama + TAG).
   Memakai engine battle cerita (2 arah, passive musuh) dengan flag bt.tower. */
const TOWER_BOSS_ROSTER=[
  {main:"CH_SHADOW_MONARCH",tag:"CH_RULER"},   /* lantai 5, 15, 25 ... */
  {main:"CH_ALMIGHTY_TYRANT",tag:"CH_DEMON_SLIME"} /* lantai 10, 20, 30 ... */
];
function towerIsBossFloor(f){return f%5===0;}
function towerBossIndex(f){return ((f/5)-1)%TOWER_BOSS_ROSTER.length;}
function towerHash(n){return (((n*2654435761)>>>0)%100000)||0;}
/* Pool musuh menara: semua kartu non-eksklusif + gate kartu BOSS (sama dgn roll: terkunci sebelum dibeli). */
function towerRegularPool(){return MASTER_CARD_INDEX.filter(c=>!c.noGacha&&(!c.raidBoss||bossRollUnlocked(c.char_id)));}
/* Kurva kesulitan absolut (tidak ikut membengkak oleh stat mentah kartu EX).
   Kartu musuh hanya menentukan identitas/art/passive; HP & ATK ditentukan lantai.
   TIER itu kosmetik — tidak ada lagi stat scaling berdasarkan tier. */
const TOWER_TIER_K={R:1,SR:1,SSR:1,UR:1,EX:1};
function towerEnemyHP(f){return Math.round(140*Math.pow(1.18,f-1));}
function towerEnemyATK(f){return Math.round(58*Math.pow(1.16,f-1));}
function towerMakeWave(charId,f,isBoss,role){
  const c=CARDS[charId];
  if(!c)return null;
  const hpK=isBoss?(role==="main"?2.2:1.4):1;
  const atkK=isBoss?(role==="main"?1.35:1.15):1;
  const tk=TOWER_TIER_K[c.tier]||1;
  const es={hp:Math.round(towerEnemyHP(f)*hpK*tk),atk:Math.round(towerEnemyATK(f)*atkK*tk)};
  const eid=charId,efx=PASSIVE_FX[eid]||{};
  const en={id:eid,name:c.name,epithet:isBoss?(role==="main"?"BOS LANTAI":"PENJAGA TAG"):c.type,img:c.sprite_asset,boss:!!isBoss,tier:c.tier,mut:"none"};
  return {en,es,eid,efx};
}
function towerWaves(f){
  const boss=towerIsBossFloor(f);
  const p=towerRegularPool();
  const pick=i=>p.length?p[towerHash(f*4+i)%p.length].char_id:null;
  const ws=[];
  if(boss){
    const r=TOWER_BOSS_ROSTER[towerBossIndex(f)];
    ws.push(towerMakeWave(r.main,f,true,"main"));
    ws.push(towerMakeWave(r.tag,f,true,"tag"));
    if(p.length){ ws.push(towerMakeWave(pick(2),f,true,"tag")); ws.push(towerMakeWave(pick(3),f,true,"tag")); }
  } else {
    for(let i=0;i<4;i++){ const id=pick(i); if(!id)break; ws.push(towerMakeWave(id,f,false,i===0?"main":"tag")); }
  }
  return ws.filter(Boolean);
}
function towerReward(f){const boss=towerIsBossFloor(f);return {coins:boss?(500+f*60):(150+f*30),starStone:0,potion:boss?2:1};}
let towerView="hub", towerRun=null;
function stopTower(){
  towerLossAutoPending=false;
  if(bt&&bt.tower){ if(bt.timer)clearTimeout(bt.timer); bt=null; }
  /* Run ditinggal (END / pindah menu) sebelum kalah: tetap cairkan roll yang sudah ditabung biar nggak hangus. */
  if(towerRun&&(towerRun.pendingRolls||0)>0){
    const n=towerRun.pendingRolls; const loot=instantRoll(n); towerRun.pendingRolls=0;
    if(loot&&loot.length)showTowerLoot(loot,towerRun.drops); else toast("ROLL TOWER DITARIK","+"+n+" KARTU","#7df9ff");
  }
  towerView="hub"; towerRun=null;
}
function towerFoeHtml(w){
  const en=w.en,es=w.es;
  return `<div class="fighter foe foe-enter" data-tier="${en.tier||''}">
    <div class="f-banner"><img src="${en.img}" alt="${en.name}"><div class="f-name">${en.name}</div>
      </div>
    <div class="hpbar"><i id="hpFoe"></i><span id="hpFoeT">${fmt(es.hp)} / ${fmt(es.hp)}</span></div>
    <div class="f-body">
      <div class="f-title">${en.epithet}</div>
      <div class="f-skill">${en.id?passiveName(en.id):"Musuh"}</div>
      <div class="stat-row"><div class="stat">&#9825; ${fmt(es.hp)}</div><div class="stat">${ATKIC} ${fmt(es.atk)}</div></div>
    </div>
  </div>`;
}
/* Rail slot musuh = 3 kotak gambar gelombang BERIKUTNYA (miror bench-rail pemain), ditambal placeholder biar tetap 3.
   Diposisikan grid CSS (.foe-side .bench-rail{grid-area:foe-slot}) jadi nongol di ATAS arena, sejajar kartu+HP pemain. */
function towerEnemyBenchRail(){
  const rem=towerRun?towerRun.waves.slice(towerRun.idx+1):[];
  let html="";
  for(let i=0;i<3;i++){
    const w=rem[i];
    if(w&&w.en){
      const wHp=(w.hp!=null?w.hp:w.es.hp),wPct=Math.max(0,Math.min(100,Math.round(wHp/w.es.hp*100)));
      html+=`<div class="bench-sq foe-sq" data-tier="${w.en.tier||''}" style="border-color:${TIER_COLOR[w.en.tier]||'var(--line)'};${w.dead?'filter:grayscale(1);opacity:.55;':''}" title="${w.en.name}${w.dead?' (KO)':''}"><img src="${w.en.img}" alt="${w.en.name}"><span class="bhp"><i style="width:${wPct}%"></i></span>${w.dead?'<b style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#ff5c5c;font-weight:800;font-size:11px">KO</b>':''}</div>`;
    } else {
      html+=`<div class="bench-sq empty"></div>`;
    }
  }
  return `<div class="bench-rail foe-rail">${html}</div>`;
}
function towerFoeSide(w){return towerFoeHtml(w)+towerEnemyBenchRail();}
// class foe-enter punya spesifisitas lebih tinggi dari .fighter.hit → hapus begitu animasi masuk selesai biar kartu musuh bisa bergoyang kena pukul
function clearFoeEnter(){setTimeout(()=>{const e=document.querySelector(".fighter.foe.foe-enter");if(e)e.classList.remove("foe-enter");},700);}
function towerEnter(f){
  if(!state.tower)state.tower={best:0};
  if(!towerRun)towerRun={cleared:0,cards:0,coins:0,drops:{weather:0,luck:0,speed:0},tokens:0,pendingRolls:0};
  if(towerRun.pendingRolls==null)towerRun.pendingRolls=0;
  towerRun.floor=f; towerRun.waves=towerWaves(f); towerRun.idx=0;
  towerView="battle";
  render();
}
function towerStartRun(){
  towerLossAutoPending=false;
  if(!state.tower)state.tower={best:0};
  towerRun={floor:1,waves:towerWaves(1),idx:0,cleared:0,cards:0,coins:0,drops:{weather:0,luck:0,speed:0},tokens:0,pendingRolls:0};
  towerView="battle";
  render();
}
function renderTower(){
  if(towerView==="battle"&&towerRun){renderTowerBattle();return;}
  if(towerView==="shop"){renderTowerShop();return;}
  renderTowerHub();
}
function towerPreviewCard(w,isBoss,role,idx){
  const id=w.eid, c=CARDS[id]; if(!c) return "";
  const tier=c.tier;
  const badge=(isBoss&&idx===0)?"BOSS":tier;
  return `<div class="tw-fcard${isBoss&&idx===0?" bossx":""}" data-tier="${tier}" style="--fc:${TIER_COLOR[tier]};animation-delay:${-idx*0.7}s">
    <img src="${c.sprite_asset}" alt="${c.name}"${c.pos?` style="object-position:${c.pos}"`:''}>
    <span class="fn">${c.name}</span>
    <span class="fb">${badge}</span>
    <span class="fs"><span class="hp"><i>HP</i> <b>${fmt(w.es.hp)}</b></span><span class="atk"><i>ATK</i> <b>${fmt(w.es.atk)}</b></span></span>
  </div>`;
}
function renderTowerHub(){
  if(!state.tower)state.tower={best:0};
  const best=state.tower.best||0;
  const start=1;                       /* selalu mulai Lantai 1 */
  const boss=towerIsBossFloor(start);
  const waves=towerWaves(start);
  /* tangga: jendela 1-12; pin REKOR di lantai best (kalau muat di jendela) */
  let fl="";
  for(let f=1;f<=12;f++){
    const isB=towerIsBossFloor(f);
    const cls=(f===start?"next":(f<=best?"cleared":"locked"))+(isB?" boss":"");
    fl+=`<div class="fl ${cls}"><span class="num">${String(f).padStart(2,"0")}</span><span class="lbl">${isB?"BOS":"GELOMBANG"}</span>${f===best&&best>0?'<span class="pin">REKOR</span>':""}</div>`;
  }
  app.innerHTML=`<div class="tw-page">
  <div class="tw-hub">
    <section class="tw-stage">
      <div class="tw-stage-eyebrow">INFINITE TOWER</div>
      <div class="twr-watermark">${start}</div>
      <div class="twr-wrap">
        <div class="beacon"></div>
        <div class="twr-shadow"></div>
        <div class="twr">${fl}</div>
      </div>
      <div class="tw-stage-hint"><kbd>MULAI</kbd> NAIK SETINGGI MUNGKIN</div>
    </section>
    <section class="tw-panel">
      <div>
        <div class="tw-title">INFINITE TOWER</div>
        <div class="tw-sub">MENARA TANPA UJUNG &middot; SEKALI JALAN DARI LANTAI 1 SAMPAI KALAH</div>
      </div>
      <div class="tw-stats">
        <div class="tbs acc"><span>BEST LANTAI</span><b>${best}</b></div>
        <div class="tbs vio"><span>TOKEN INF</span><b>${fmt(state.infTokens||0)}</b></div>
        <div class="tbs"><span>LANTAI MULAI</span><b>${start}</b></div>
      </div>
      <div class="eyebrow">MUSUH &middot; LANTAI ${start}</div>
      <div class="tw-foes">${waves.map((w,i)=>towerPreviewCard(w,boss,i===0?"main":"tag",i)).join("")}</div>
      <div class="tw-acts">
        <button class="act go" id="towerGo">
          <span class="amed"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="M19 21l2-2"/></svg></span>
          <span class="atxt"><small>Mulai run baru</small><b>MULAI DARI LANTAI ${start}</b></span>
        </button>
        <button class="act violet" id="towerShop">
          <span class="amed"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></span>
          <span class="atxt"><small>Belanja token</small><b>TOKO INF</b></span>
        </button>
        <button class="act cyan" id="towerLobby">
          <span class="amed"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg></span>
          <span class="atxt"><small>Kembali</small><b>LOBBY</b></span>
        </button>
      </div>
      <p class="tw-note">Tiap lantai ditaklukkan: musuh mati &rarr; otomatis naik ke lantai berikutnya (tanpa konfirmasi). Peluang hadiah per lantai: <b class="c">Instant roll 50 kartu (50%)</b> &middot; Weather Potion (5%) &middot; Luck Potion +1 (10%) &middot; Speed Potion +1 (10%). Tiap lantai juga kasih <b class="v">+1 Token Inf</b> (bos +5) buat dibelanjakan di TOKO INF.</p>
    </section>
  </div></div>`;
  const g=document.getElementById("towerGo");if(g)g.onclick=()=>{sfx.hit();towerStartRun();};
  const s=document.getElementById("towerShop");if(s)s.onclick=()=>{sfx.hit();towerView="shop";render();};
  const lb=document.getElementById("towerLobby");if(lb)lb.onclick=()=>{try{sfx.hit();}catch(e){}location.hash="#/";};
}
function renderTowerShop(){
  if(!state.tower)state.tower={best:0};
  const tok=state.infTokens||0;
  const ICON={weather:'<img src="assets/images/icon-potion.png" onerror="this.parentNode.textContent=\'🧪\'">',mythic:'✨',
    luck1:'<img src="assets/images/pot-luck-1.png" onerror="this.parentNode.textContent=\'🍀\'">',luck2:'<img src="assets/images/pot-luck-2.png" onerror="this.parentNode.textContent=\'🍀\'">',luck3:'<img src="assets/images/pot-luck-3.png" onerror="this.parentNode.textContent=\'🍀\'">',
    speed1:'<img src="assets/images/pot-speed-1.png" onerror="this.parentNode.textContent=\'⚡\'">',speed2:'<img src="assets/images/pot-speed-2.png" onerror="this.parentNode.textContent=\'⚡\'">',speed3:'<img src="assets/images/pot-speed-3.png" onerror="this.parentNode.textContent=\'⚡\'">'};
  const item=(k,label,desc,cost)=>`<div class="inf-item">
      <div class="inf-item-ic">${ICON[k]||'🧪'}</div>
      <div class="inf-item-info"><div class="inf-item-name">${label}</div><div class="inf-item-desc">${desc}</div></div>
      <button class="inf-item-buy" ${tok<cost?'disabled':''} onclick="infBuy('${k}')">${cost}<small>TOKEN</small></button>
    </div>`;
  /* data item (teks & harga = versi live) — state dari state live */
  const ITEMS=[
    {k:"weather",label:"WEATHER POTION",sub:"Gacha cuaca ikut chance asli, 5 menit (hasil sama/lebih bagus dari cuaca aktif = pindah + reset timer; lebih jelek = cuaca tetep).",cost:10,req:null,ac:"var(--ice)"},
    {k:"luck1",label:"LUCK POTION L1",sub:"+3 flat luck selama 5 menit. Stackable — durasi nambah +5 menit tiap pot.",cost:10,req:null,ac:"var(--green)"},
    {k:"luck2",label:"LUCK POTION L2",sub:"+5 flat luck & +10% luck selama 5 menit. Stackable — durasi nambah +5 menit tiap pot.",cost:50,req:null,ac:"var(--green)"},
    {k:"luck3",label:"LUCK POTION L3",sub:"+10 flat luck & +20% luck selama 5 menit. Stackable — durasi nambah +5 menit tiap pot.",cost:250,req:null,ac:"var(--green)"},
    {k:"speed1",label:"SPEED POTION L1",sub:"Roll speed +0.2× (≈1.2×) selama 5 menit. Stackable — durasi nambah +5 menit tiap pot.",cost:10,req:null,ac:"var(--amber)"},
    {k:"speed2",label:"SPEED POTION L2",sub:"Roll speed +0.5× (≈1.5×) selama 5 menit. Stackable — durasi nambah +5 menit tiap pot.",cost:50,req:null,ac:"var(--amber)"},
    {k:"speed3",label:"SPEED POTION L3",sub:"Roll speed +1.0× (2×) selama 5 menit. Stackable — durasi nambah +5 menit tiap pot.",cost:250,req:null,ac:"var(--amber)"},
    {k:"mythic",label:"MYTHIC WEATHER POTION",sub:"Upgrade 1 Weather Potion -> Mythic: APOCALYPSE chance 3% (durasi 5 menit). Butuh 1 Weather Potion.",cost:50,req:"weather",ac:"var(--violet)"}
  ];
  const stkOf=k=>k==="weather"?(state.potions||0):k.startsWith("luck")?(state.luckPots&&state.luckPots[+k.slice(-1)-1])||0:k.startsWith("speed")?(state.speedPots&&state.speedPots[+k.slice(-1)-1])||0:(state.mythicPotions||0);
  if(window.shopSel==null||window.shopSel>=ITEMS.length)window.shopSel=0;
  let swapT=null;
  const renderList=()=>{
    document.getElementById("shopList").innerHTML=ITEMS.map((it,i)=>`
      <div class="srow${i===window.shopSel?" on":""}" data-i="${i}" style="--ac:${it.ac}">
        <span class="sic">${ICON[it.k]||"🧪"}</span>
        <span class="sinfo"><span class="sname">${it.label}</span></span>
        <span class="scost"><b>${it.cost}</b><span>TOKEN</span></span>
        ${stkOf(it.k)>0?`<span class="sown">&times;${stkOf(it.k)}</span>`:""}
      </div>`).join("");
    document.querySelectorAll(".srow").forEach(r=>r.onclick=()=>{window.shopSel=+r.dataset.i;renderList();renderDetail();});
  };
  const renderBuy=()=>{
    const it=ITEMS[window.shopSel],btn=document.getElementById("shopBuy");
    /* restart animasi biar tombol ikut gerak tiap ganti item */
    btn.style.animation="none";void btn.offsetWidth;btn.style.animation="";
    let small="Beli item ini",big=`BELI — ${it.cost} TOKEN`,dis=false;
    if(tok<it.cost){small="Token tidak cukup";big=`KURANG ${it.cost-tok} TOKEN`;dis=true;}
    else if(it.req&&stkOf(it.req)<=0){small="Syarat belum terpenuhi";big="BUTUH 1 WEATHER POTION";dis=true;}
    btn.disabled=dis;
    btn.innerHTML=`<span class="amed">${ICON[it.k]||"🧪"}</span><span class="atxt"><small>${small}</small><b>${big}</b></span>`;
  };
  const renderDetail=immediate=>{
    const it=ITEMS[window.shopSel],box=document.getElementById("shopDetail");
    clearTimeout(swapT);
    const paint=()=>{
      box.classList.remove("out");
      box.innerHTML=`
      <div class="sd-head" style="--ac:${it.ac}">
        <span class="sbig">${ICON[it.k]||"🧪"}</span>
        <span><span class="sd-kicker">${it.k==="mythic"?"UPGRADE · MYTHIC":"POTION · KONSUMSI"}</span><div class="sd-name">${it.label}</div></span>
      </div>
      <p class="sd-desc">${it.sub}</p>
      <div class="sd-meta" style="--ac:${it.ac}">
        <div class="sd-mrow"><span class="k">HARGA</span><span class="v c">${it.cost} TOKEN INF</span></div>
        <div class="sd-mrow"><span class="k">DIMILIKI</span><span class="v g">&times;${stkOf(it.k)}</span></div>
        ${it.req?`<div class="sd-mrow"><span class="k">SYARAT</span><span class="v ${stkOf(it.req)>0?"v":"no"}">${stkOf(it.req)>0?"PUNYA ×"+stkOf(it.req)+" WEATHER":"BUTUH 1 WEATHER POTION"}</span></div>`:""}
        <div class="sd-mrow"><span class="k">SISA TOKEN</span><span class="v c">${tok} / ${it.cost}</span></div>
      </div>`;
      renderBuy();
    };
    if(immediate||!box.children.length){paint();return;}
    box.classList.add("out");              /* fade + geser keluar dulu */
    swapT=setTimeout(paint,140);           /* lalu ganti isi + stagger masuk */
  };
  app.innerHTML=`<div class="tw-page">
  <div class="tw-hub shop-hub">
    <section class="tw-stage shop-stage">
      <div class="tw-stage-top">
        <button class="backlink" id="shopBack">&#8592; KEMBALI KE TOWER</button>
        <div class="tw-stage-eyebrow">TOKO INF</div>
      </div>
      <div class="slist" id="shopList"></div>
      <div class="tw-stage-hint"><kbd>TOKEN</kbd> DIDAPAT TIAP LANTAI DITAKLUKKAN</div>
    </section>
    <section class="tw-panel">
      <div>
        <div class="tw-title">TOKO INF</div>
        <div class="tw-sub">BELANJA PAKAI TOKEN INF &middot; HASIL NAIK LANTAI</div>
      </div>
      <div class="tw-stats">
        <div class="tbs acc"><span>TOKEN INF</span><b>${fmt(tok)}</b></div>
        <div class="tbs vio"><span>MYTHIC</span><b>${fmt(state.mythicPotions||0)}</b></div>
        <div class="tbs"><span>WEATHER</span><b>${fmt(state.potions||0)}</b></div>
      </div>
      <div class="eyebrow">DETAIL ITEM</div>
      <div class="sdetail" id="shopDetail"></div>
      <button class="act go buyswap" id="shopBuy"></button>
      <p class="tw-note">Tiap lantai ditaklukkan: <b class="v">+1 Token Inf</b> (bos lantai kelipatan 5: <b class="v">+5</b>) &middot; Drop potion per lantai: <b class="c">Weather 5%</b> &middot; Luck 10% &middot; Speed 10%.</p>
    </section>
  </div></div>`;
  renderList();renderDetail(true);
  const rb=document.getElementById("shopBack");if(rb)rb.onclick=()=>{try{sfx.hit();}catch(e){}towerView="hub";render();};
  const bi=document.getElementById("shopBuy");if(bi)bi.onclick=()=>{if(bi.disabled)return;infBuy(ITEMS[window.shopSel].k);};
}
function infBuy(kind){
  const cost={weather:10,luck1:10,luck2:50,luck3:250,speed1:10,speed2:50,speed3:250,mythic:50}[kind]; if(cost==null)return;
  if((state.infTokens||0)<cost){toast("TOKEN KURANG","TOKEN INF TIDAK CUKUP","#f87171");return;}
  if(kind==='mythic'&&(state.potions||0)<1){toast("Butuh 1 Weather Potion","GAK BISA","#f87171");return;}
  state.infTokens-=cost;
  if(kind==='weather')state.potions=(state.potions||0)+1;
  else if(kind.startsWith('luck')){state.luckPots=state.luckPots||[0,0,0];state.luckPots[+kind.slice(-1)-1]++;}
  else if(kind.startsWith('speed')){state.speedPots=state.speedPots||[0,0,0];state.speedPots[+kind.slice(-1)-1]++;}
  else if(kind==='mythic'){state.potions--;state.mythicPotions=(state.mythicPotions||0)+1;}
  save(); beep(660,.1,"sine",.07);
  const label={weather:'WEATHER POTION',mythic:'MYTHIC POTION'}[kind]||(kind.startsWith('luck')?'LUCK POTION L'+kind.slice(-1):'SPEED POTION L'+kind.slice(-1));
  toast(label,"-"+cost+" TOKEN","#c4b5fd");
  renderShell(); if(towerView==="shop")render();
}
function renderTowerBattle(){
  const w=towerRun.waves[towerRun.idx];
  const eq=equipped(),st=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  app.innerHTML=`
  <div class="battle-grid tower-stage">
  <div class="me-col">
    <div class="fighter me${eq?mutGlow(eq.mut):''}${shinyCls(eq)}" data-tier="${eq?eq.tier:''}" data-char="${eq?eq.char:''}"${eq?mutEdge(eq.mut):''}>${meFighterHtml(eq)}</div>
    ${benchHtml()}
  </div>
  <div class="vs-col"><div class="t">VS</div><div class="s" id="turnLabel">LANTAI <b>${towerRun.floor}</b> · ${towerIsBossFloor(towerRun.floor)?"BOS":"GELOMBANG <b>"+(towerRun.idx+1)+"/"+towerRun.waves.length+"</b>"}</div><button class="bspeed-btn" id="bspeedBtn" type="button">1×</button></div>
  <div class="me-col foe-side" id="foeSide">${towerFoeSide(w)}</div>
  </div>`;
  wireSpeedBtn();
  clearFoeEnter();
  const meEl0=document.querySelector(".fighter.me"),foeEl0=document.querySelector(".fighter.foe");
  if(meEl0){meEl0.classList.add("tag-enter");setTimeout(()=>{try{meEl0.classList.remove("tag-enter");}catch(e){}},650);enterFx(meEl0);}
  if(foeEl0)enterFx(foeEl0);
  playFight(startTowerBattle);
}
function startTowerBattle(){
  if(bt)return; /* playFight bisa kepanggil ulang dr renderTowerBattle — jangan reset battle yang masih hidup */
  const w=towerRun.waves[towerRun.idx];
  const fighters=equippedList();if(!fighters.length)fighters.push(equipped());
  const eq=fighters[0],base=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  if(bt&&bt.timer)clearTimeout(bt.timer);
  bt={speed:battleSpeedEff(),fgen:1,lv:null,tower:true,en:w.en,es:w.es,eq,fighters,eid:w.eid,efx:w.efx,active:0,revUsed:new Array(fighters.length).fill(false),justTagged:false,pHp:base.hp,pMax:base.hp,eHp:w.es.hp,turn:1,over:false,eBurn:0,ePoison:0,pGuardDr:0,eAbilityOff:0,voidUsed:false,pCopyFx:null,spCd:[],spTurn:[],spArmed:[],spWave:[],meteorGuard:[],phase2used:false,domainUsed:false,domainLeft:0,eStun:0,pStun:0,pDr:0,pDrTurns:0,atkBuff:new Array(fighters.length).fill(0),dodgeStack:new Array(fighters.length).fill(0),atkCount:new Array(fighters.length).fill(0),standUsed:new Array(fighters.length).fill(false),styleCount:new Array(fighters.length).fill(0),snatchAtk:new Array(fighters.length).fill(0),snatchHp:new Array(fighters.length).fill(0),regressCharges:new Array(fighters.length).fill(0),bioGuard:new Array(fighters.length).fill(false),splitLeft:new Array(fighters.length).fill(0),splitMult:new Array(fighters.length).fill(1),burstStart:new Array(fighters.length).fill(1),entryGuard:new Array(fighters.length).fill(false),dodgeArmed:new Array(fighters.length).fill(false),dodgeCount:new Array(fighters.length).fill(0),execGuard:new Array(fighters.length).fill(false),wtCount:new Array(fighters.length).fill(0),shatterGuard:new Array(fighters.length).fill(false),defyUsed:new Array(fighters.length).fill(false),defyHold:false,openGuard:true,dsState:new Array(fighters.length).fill(0),gumTurns:0,trickNext:false,royalNow:false,gunsNow:false,psychic:null,atkEntryGuard:new Array(fighters.length).fill(false),sleepLeft:new Array(fighters.length).fill(0),sleepArmed:new Array(fighters.length).fill(false),overflow:0,rain:null,freezeLeft:0,shockCount:new Array(fighters.length).fill(0),shadow:null,freezeNext:false,valhallaLeft:0,paintHits:[],eInk:0,eInkPct:0,wc:null,rearIdx:-1,rearWaiting:false,rearUsed:[],senzu:{},senzuFin:false,balloon:0,stretchShot:0,turret:0,hvCount:new Array(fighters.length).fill(0),excited:false,weCount:new Array(fighters.length).fill(0),weRevived:false,pbRocks:0,pbKey:"",pbStreak:0,rubber:false,rbBounce:0,dizzyStack:0,dizzyLeft:0};
  const tfx=resolveFx(eq,w.efx);
  if(tfx&&tfx.entryCounter)bt.entryGuard[0]=true;
  if(tfx&&tfx.entryShatter)bt.shatterGuard[0]=true;
  if(tfx&&tfx.entryMaxHp)bt.bioGuard[0]=true;
  if(tfx&&tfx.meteorWave)bt.meteorGuard[0]=true;
  if(tfx&&tfx.entryAtkPct)bt.atkEntryGuard[0]=true;
  armShotFx(tfx,0);partyDmgApply(tfx);
  if(tfx&&tfx.psychicBarrier)bt.psychic={left:tfx.psychicBarrier.turns,dr:tfx.psychicBarrier.dr,healPct:tfx.psychicBarrier.healPct};
  if(tfx&&tfx.sleepStrike){bt.sleepLeft[0]=tfx.sleepStrike.turns;bt.sleepArmed[0]=true;}
   if(tfx&&tfx.entryFreeze&&!foeStatusImmune()){bt.eStun=tfx.entryFreeze.turns;bt.freezeLeft=tfx.entryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","BEKU","crit"),bsMs(300));}
   if(tfx&&tfx.heavyRain)bt.rain={left:tfx.heavyRain.turns,healPct:tfx.heavyRain.healPct};
   if(tfx&&tfx.timeStop&&!foeStatusImmune()){bt.eStun=tfx.timeStop.turns;setTimeout(()=>floatText(".fighter.foe","THE WORLD","crit"),bsMs(300));}
  if(tfx&&tfx.dimensionShift){bt.eAbilityOff=tfx.dimensionShift.turns;setTimeout(()=>floatText(".fighter.foe","AMENOMINAKA","crit"),bsMs(300));}
if(tfx)bt.pGuardDr=tfx.puppetBody?tfx.puppetBody.dr:(tfx.autoBlock?tfx.autoBlock.pct:0);
if(tfx&&tfx.valhalla){bt.valhallaLeft=tfx.valhalla.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT OF VALHALLA","crit");},bsMs(360));}
if(tfx.senzu){const _szb=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);bt.senzu={baseAtk:_szb.atk,baseHp:bt.pMax,atkSum:0,hpSum:0,turn:0};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MUNCH MUNCH!","heal");},bsMs(420));}
if(tfx.turret)bt.turret=tfx.turret.start;
bt.rubber=!!(tfx&&tfx.rubberField);if(bt.rubber)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","RUBBER FIELD","crit");},bsMs(520));
if(tfx.stretch){setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GOMU GOMU... WAIT WHAT?!","crit");},bsMs(520));}
if(tfx.dupEntry){bt.pMax=Math.round(bt.pMax*2);bt.pHp=bt.pMax;bt.atkBuff[bt.active]+=100;setTimeout(()=>{if(bt&&!bt.over){setBar("hpMe","hpMeT",bt.pHp,bt.pMax);floatText(".fighter.me","DATA DUPLICATED x2","crit");}},bsMs(420));}
if(tfx.worldCorrupt){bt.wc={c:0,atk:Math.round(cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk),every:tfx.worldCorrupt.every,pct:tfx.worldCorrupt.pct,dmgUp:tfx.worldCorrupt.dmgUp};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","ABILITY CORRUPTED","crit");},bsMs(520));}
  bt.fighters.forEach((f,i)=>{const x=resolveFx(f,w.efx);if(x.splitDeath)bt.splitLeft[i]=x.splitDeath.times;});
  schedPhase(700,step);
}
function foeDown(){
  /* RE-ENTRANCY GUARD: AOE (meteor/quake) + serangan biasa bisa men-schedule foeDown 2x untuk kill yang sama.
     Tanpa guard ini advanceTowerFoe kejar 2x: gelombang hidup ke-skip, kill-reward dobel, dan musuh kebagian giliran dobel.
     Hasilnya kartu pemain mati mendadak pas ngeluarin AOE di tower. */
  if(!bt||bt.over)return;
  if(bt.eHp>0)return;/* STALE-CALL GUARD: kill ini udah keproses — musuh baru udah ke-load (eHp>0), jangan advance dobel */
  if(bt.foeDowning)return;
  bt.foeDowning=true;
  /* SNATCH: kartu aktif yang punya fx.snatch mencuri pct% stat musuh yang baru tumbang, permanen */
  if(bt&&!bt.over&&!bt.aftermath&&bt.pHp>0){
    const a=bt.active,sfx=resolveFx(bt.eq,bt.efx);
    if(sfx.snatch){
      const sa=Math.round(bt.es.atk*sfx.snatch.pct/100), sh=Math.round(bt.es.hp*sfx.snatch.pct/100);
      bt.snatchAtk[a]=(bt.snatchAtk[a]||0)+sa; bt.snatchHp[a]=(bt.snatchHp[a]||0)+sh;
      bt.pMax+=sh; bt.pHp=Math.min(bt.pMax,bt.pHp+sh);
      setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
      setTimeout(()=>{if(bt&&!bt.over){floatText(".fighter.me","SNATCH +"+fmt(sa)+" ATK +"+fmt(sh)+" HP","crit");}},bsMs(260));
    }
    /* REGRESSION (Regressor): tiap kill nyimpen 1 'charge' buat bangkit nanti (dipakai di trySave) */
    if(sfx.regression){bt.regressCharges[a]=(bt.regressCharges[a]||0)+1;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","REGRESSION READY","heal");},bsMs(300));}
    if(sfx.killHeal&&bt.pHp>0){const kh=Math.max(1,Math.round(bt.pMax*sfx.killHeal.pct/100));bt.pHp=Math.min(bt.pMax,bt.pHp+kh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","HISAP DARAH +"+fmt(kh),"heal");},bsMs(340));}
    /* FREEZE TRANSFER (ABSOLUTE ZERO): musuh tumbang dalam keadaan BEKU -> freeze pindah ke kartu musuh berikutnya */
    if(sfx.freezeTransfer&&(bt.freezeLeft||0)>0){bt.freezeNext=true;}
    if(sfx.getExcited){bt.excited=true;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GET EXCITED!","crit");},bsMs(300));}
    /* GLUTTONY (Demon Slime): serap pct% ATK & max-HP musuh tumbang (pola snatch) + salin ability musuh TERBARU */
    if(sfx.gluttony){
      const ga=Math.round(bt.es.atk*sfx.gluttony.pct/100),gh=Math.round(bt.es.hp*sfx.gluttony.pct/100);
      bt.snatchAtk[a]=(bt.snatchAtk[a]||0)+ga; bt.snatchHp[a]=(bt.snatchHp[a]||0)+gh;
      bt.pMax+=gh;if(sfx.gluttony&&sfx.gluttony.healPct){const glh=Math.max(1,Math.round(bt.pMax*sfx.gluttony.healPct/100));bt.pHp=Math.min(bt.pMax,bt.pHp+glh);} bt.pHp=Math.min(bt.pMax,bt.pHp+gh);
      if(bt.efx&&!(sfx.gluttony&&sfx.gluttony.noCopy))bt.pCopyFx=Object.assign({},bt.efx);
      setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GLUTTONY +"+fmt(ga)+" ATK +"+fmt(gh)+" HP","crit");},bsMs(300));
    }  }
  /* ARISE (Shadow Monarch): setelah membunuh & masih ada gelombang berikutnya, bangkitkan musuh yang baru mati
     sebagai bayangan (40% stat) yang MENGAMBIL-ALIH slot Monarch. HP asli Monarch disimpan buat balik nanti. */
  if(bt&&!bt.over&&!bt.aftermath&&!bt.shadow&&bt.pHp>0&&bt.tower&&towerRun&&towerRun.idx+1<towerRun.waves.length){
    const mfx=resolveFx(bt.eq,bt.efx);
    if(mfx.arise){
      const pct=mfx.arise.pct;
      bt.shadow={name:bt.en.name,img:bt.en.img,atk:Math.max(1,Math.round(bt.es.atk*pct/100)),maxHp:Math.max(1,Math.round(bt.es.hp*pct/100)),turnsLeft:mfx.arise.turns,retHp:bt.pHp,retMax:bt.pMax};
      bt.pHp=bt.shadow.maxHp;bt.pMax=bt.shadow.maxHp;
      updateMeCard();setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","ARISE!","crit");},bsMs(260));
    }
  }
  if(bt&&bt.tower&&towerRun&&towerRun.idx+1<towerRun.waves.length){advanceTowerFoe();return;}
  endBattle(true);
}
/* lineupAoeHit: damage AoE kena musuh AKTIF (urusan caller) + SELURUH slot CADANGAN tower (waves sisa setelah idx).
   Cadangan lazy-init w.hp = w.es.hp; w.hp habis -> w.dead=true: rail kasih tanda KO, advanceTowerFoe nge-skip,
   dan kalau sisa semua mati -> endBattle(true). Mode story (bukan tower) no-op karena musuh cuma 1. */
/* lineupNextHit: damage FLAT ke slot CADANGAN tower terdepan yang masih hidup (serangan pierce "yang di belakangnya"); story no-op */
function lineupNextHit(dmg){
  if(!bt||bt.over||!bt.tower||!towerRun||!(dmg>0))return;
  let hitW=null;
  for(let i=towerRun.idx+1;i<towerRun.waves.length;i++){
    const w=towerRun.waves[i];
    if(!w||w.dead)continue;
    hitW=w;break;
  }
  if(!hitW)return;
  if(hitW.hp==null)hitW.hp=hitW.es.hp;
  hitW.hp-=dmg;
  if(hitW.hp<=0){hitW.hp=0;hitW.dead=true;}
  const rail=document.querySelector(".foe-rail");
  if(rail)rail.outerHTML=towerEnemyBenchRail();
  setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","PIERCE -"+fmt(dmg),"crit");},bsMs(640));
}
function lineupAoeHit(dmg){
  if(!bt||bt.over||!bt.tower||!towerRun||!(dmg>0))return;
  let killed=0;
  for(let i=towerRun.idx+1;i<towerRun.waves.length;i++){
    const w=towerRun.waves[i];
    if(!w||w.dead)continue;
    if(w.hp==null)w.hp=w.es.hp;
    w.hp-=dmg;
    if(w.hp<=0){w.hp=0;w.dead=true;killed++;}
  }
  const rail=document.querySelector(".foe-rail");
  if(rail)rail.outerHTML=towerEnemyBenchRail();
  setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","AOE -"+fmt(dmg)+" (lineup)","crit");},bsMs(640));
  if(killed)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe",killed+" CADANGAN KO!","crit");},bsMs(900));
}
function advanceTowerFoe(){
  if(!bt||bt.over)return;
  bt.fgen=(bt.fgen||0)+1;/* generasi musuh: cb basi dari kill sebelumnya bakal kebuang */
  do{towerRun.idx++;}while(towerRun.idx<towerRun.waves.length&&towerRun.waves[towerRun.idx]&&towerRun.waves[towerRun.idx].dead);
  if(towerRun.idx>=towerRun.waves.length){endBattle(true);return;}
  const w=towerRun.waves[towerRun.idx];
  bt.en=w.en;bt.es=w.es;bt.eid=w.eid;bt.efx=w.efx;bt.eHp=w.es.hp;
  bt.openGuard=true;bt.eBurn=0;bt.eStun=0;bt.phase2used=false;bt.domainUsed=false;bt.domainLeft=0;bt.domainNow=false;
  {const rfx=resolveFx(bt.eq,bt.efx);if(rfx.dimensionShift)bt.eAbilityOff=rfx.dimensionShift.turns;}
    {const cfx=resolveFx(bt.eq,bt.efx);if(cfx.copy&&cfx.copy.turns)bt.copyLeft=cfx.copy.turns;}
  {const nfx=resolveFx(bt.eq,bt.efx);
   /* FOE ENTRY FREEZE (ICE QUEEN): musuh baru masuk -> bekukan turns giliran (pola entryFreeze, guard statusImmune) */
   if(nfx.foeEntryFreeze&&!foeStatusImmune()){bt.eStun=nfx.foeEntryFreeze.turns;bt.freezeLeft=nfx.foeEntryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","BEKU","crit"),bsMs(300));}
   /* FREEZE TRANSFER (ABSOLUTE ZERO): musuh ini mewarisi freeze dari target beku yang dibunuh sebelumnya */
   if(bt.freezeNext){bt.freezeNext=false;if(!foeStatusImmune()){bt.eStun=Math.max(bt.eStun,1);bt.freezeLeft=Math.max(bt.freezeLeft,1);setTimeout(()=>floatText(".fighter.foe","BEKU","crit"),bsMs(360));}}
  }
bt.ePoison=0;bt.dizzyStack=0;bt.dizzyLeft=0;bt.rbBounce=0;bt.pbKey="";bt.pbStreak=0;
  /* THUNDERCLAP FLASH overflow dari gelombang sebelumnya langsung menghantam musuh baru ini */
  if(bt.overflow&&bt.overflow>0){bt.eHp-=bt.overflow;bt.overflow=0;}
  /* sama seperti tag-in pemain: slot 1 tumbang dulu di arena, lalu slot 2 naik dan slot 1 jatuh ke TAG
     dengan tanda ✕ — sebelumnya kartu gelombang 1 langsung diganti diam-diam */
  const downEl=document.querySelector(".fighter.foe");
  if(downEl){downEl.classList.remove("foe-enter");downEl.classList.add("ko");koFx(downEl);}
  floatText(".fighter.foe","KO","crit");
  bt.turn++;
  setTimeout(()=>{
    if(!bt||bt.over)return;
    const side=document.getElementById("foeSide");
    if(side)side.innerHTML=towerFoeHtml(w)+towerEnemyBenchRail();
    clearFoeEnter();
    setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
    if(bt.eHp<bt.es.hp)setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","THUNDERCLAP","crit");}},bsMs(500));
    const foeEl=side?side.querySelector(".fighter.foe"):null;
    if(foeEl){enterFx(foeEl);}
    const tl=document.getElementById("turnLabel");if(tl)tl.innerHTML="LANTAI <b>"+towerRun.floor+"</b> · GELOMBANG <b>"+(towerRun.idx+1)+"/"+towerRun.waves.length+"</b>";
    floatText(".fighter.foe","TAG-IN!","heal");
    if(bt.excited){bt.excited=false;floatText(".fighter.foe","EXTRA ATTACK!","crit");schedPhase(1000,playerPhase);}else schedPhase(1000,enemyPhase);
  },bsMs(2000));
}
function towerEnd(win){
  if(bt){clearTimeout(bt.timer);bt.over=true;}
  const f=towerRun.floor;
  if(win){
    /* Menang lantai: kasih hadiah lalu LANGSUNG naik lantai berikutnya tanpa overlay. */
    const r=towerReward(f); state.coins+=r.coins;
    /* Drop tiap floor lolos: Instant roll 100% PASTI (DITABUNG, di-roll saat kalah) — 25×ceil(lantai/10), +25 tiap band 10 lantai · Weather 5% · Luck +1 10% · Speed +1 10% */
    if(!towerRun.drops)towerRun.drops={weather:0,luck:0,speed:0};
    const rr=25*Math.ceil(f/10);
    towerRun.pendingRolls=(towerRun.pendingRolls||0)+rr; towerRun.cards=(towerRun.cards||0)+rr;
    if(Math.random()<0.05){state.potions=(state.potions||0)+1;towerRun.drops.weather++;}
    if(Math.random()<0.10){state.luckPots=state.luckPots||[0,0,0];state.luckPots[0]++;towerRun.drops.luck++;}
    if(Math.random()<0.10){state.speedPots=state.speedPots||[0,0,0];state.speedPots[0]++;towerRun.drops.speed++;}
    /* DROP LANGKAH CRAYON V2 — BASE murni TANPA luck player (totalLuck TIDAK dipakai): pedang-api 0,1% · kyubi 0,01% per lantai. */
    const rare=[];
    if(!state.artOwned.includes("pedang-api")&&Math.random()<0.001){state.artOwned.push("pedang-api");rare.push("ARTEFAK PEDANG API · +120 FLAT & +100% LUCK");}
    if(!state.petOwned.includes("kyubi")&&Math.random()<0.0001){state.petOwned.push("kyubi");rare.push("PET KYUBI FOX · +200 FLAT & +300% LUCK");}
    /* Token Inf: +1 per lantai, +5 per lantai bos. */
    const tok=towerIsBossFloor(f)?5:1;
    state.infTokens=(state.infTokens||0)+tok; towerRun.tokens=(towerRun.tokens||0)+tok;
    towerRun.cleared=f; towerRun.coins=(towerRun.coins||0)+r.coins;
    state.tower.best=Math.max(state.tower.best||0,f);
    save(); renderShell(); fanfare();
    toast("LANTAI "+f+" DITAKLUKKAN","+"+rr+" ROLL DISIMPAN · "+"+"+tok+" TOKEN","#7df9ff");
    rare.forEach((m,i)=>setTimeout(()=>toast("DROP LANGKAH · LANTAI "+f,m,"#fb923c"),700*(i+1)));
    bt=null;
    towerEnter(f+1);
    return;
  }
  /* Kalah: run berhenti — cairkan SEMUA roll yang ditabung SEBELUM sfx/DOM apa pun
     (apapun yang error sesudahnya, reward tetap aman & pendingRolls gak dobel).
     TANPA overlay KALAH: langsung balik ke hub Tower tepat di balik popup hasil roll,
     dan kalau AUTO RESTART aktif, run baru Lantai 1 menyusul setelah popup ditutup. */
  const pending=towerRun.pendingRolls||0;
  let loot=[];
  try{ loot=pending>0?instantRoll(pending):[]; }
  catch(err){ console.error("towerEnd instantRoll error",err); }
  towerRun.pendingRolls=0;
  try{ sfx.lose(); }catch(e){}
  const reached=towerRun.cleared||0;
  const dr=towerRun.drops||{weather:0,luck:0,speed:0};
  const auto=!!(state&&state.tower&&state.tower.auto);
  towerLossAutoPending=auto;
  try{ save(); renderShell(); }catch(e){}
  try{ toast("RUN BERAKHIR DI LANTAI "+f,"LANTAI DITAKLUKKAN: "+reached+" · KARTU +"+fmt(towerRun.cards||0)+" · TOKEN +"+fmt(towerRun.tokens||0),"#f87171"); }catch(e){}
  /* Popup hasil roll (kartu + potion) tetap tampil — z-220, di atas segalanya. */
  try{ showTowerLoot(loot,dr); }
  catch(err){ console.error("showTowerLoot error",err); }
  /* Lobby Tower muncul di belakang popup: begitu AMBIL diklik, pemain sudah di hub. */
  try{ stopBattleLoop(); }catch(e){}
  towerView="hub";
  try{ render(); }catch(e){}
  /* Auto-restart tapi gak ada yang bisa diklik (run tuntas sebelum lantai apa pun
     ditaklukkan → loot & potion kosong → popup gak muncul): restart setelah jeda singkat. */
  if(auto&&!loot.length&&!(dr.weather+dr.luck+dr.speed)){
    setTimeout(()=>{
      if(!towerLossAutoPending)return;
      towerLossAutoPending=false;
      try{ towerStartRun(); }catch(e){ console.error("tower auto-restart error",e); }
    },1200);
  }
}
function showTowerLoot(results,drops,title){
  const pop=document.getElementById("rollResultPop");if(!pop)return;
  results=results||[];
  const d=drops||{weather:0,luck:0,speed:0};
  const POTION=[{k:'weather',name:'WEATHER',icon:'assets/images/icon-potion.png',emoji:'🧪'},{k:'luck',name:'LUCK',icon:'assets/images/pot-luck-1.png',emoji:'🍀'},{k:'speed',name:'SPEED',icon:'assets/images/pot-speed-1.png',emoji:'⚡'}];
  const totalPot=POTION.reduce((s,p)=>s+(d[p.k]||0),0);
  if(!results.length&&!totalPot)return;
  const potChips=POTION.filter(p=>(d[p.k]||0)>0).map(p=>{const n=d[p.k]||0;return `<div class="rrc rrc-potion" title="${p.name} POTION"><i class="rrc-sizer"></i><span class="rrc-pot-ic"><img src="${p.icon}" alt="${p.name}" onerror="this.parentNode.textContent='${p.emoji}'"></span>${n>1?`<span class="rrc-cnt">×${n}</span>`:''}<span class="rrc-name">${p.name}</span></div>`;}).join("");
  const groups={};
  results.forEach(r=>{const key=r.cardId+"|"+(r.mut||"none")+"|"+(r.shiny||"none");(groups[key]=groups[key]||{cardId:r.cardId,tier:r.tier,mut:r.mut||"none",shiny:!!(r.shiny&&r.shiny!=="none"),n:0}).n++;});
  const list=Object.values(groups).sort((a,b)=>luckChance(b.cardId,b.mut,b.shiny)-luckChance(a.cardId,a.mut,a.shiny)||b.n-a.n);
  document.getElementById("rrTotal").textContent=fmt(results.length)+" kartu"+(list.length?" · "+list.length+" jenis unik":"")+(totalPot?" · "+fmt(totalPot)+" potion":"");
  document.getElementById("rrBody").innerHTML=potChips+list.map(g=>{
    const name=cardName(g.cardId),img=cardImg(g.cardId);
    const isShiny=g.shiny&&g.shiny!=="none", isMut=g.mut&&g.mut!=="none";
    const varTag=(isShiny||isMut)?`<span class="rrc-var">${isShiny?'<span class="rrc-shine">SHINY</span>':''}${isMut?`<span class="rrc-mut" style="border-color:${MUT_COLOR[g.mut]||'#fff'}">${mutBadge(g.mut)}</span>`:''}</span>`:'';
    let rc="rrc";if(isMut)rc+=" mut-"+g.mut;if(isShiny)rc+=" shiny";
    return `<div class="${rc}"><i class="rrc-sizer"></i><img src="${img}" alt="${name}" title="${name}" onerror="this.style.display='none'">${varTag}${g.n>1?`<span class="rrc-cnt">×${g.n}</span>`:''}<span class="rrc-name">1/${fmtC(luckChance(g.cardId,g.mut,g.shiny))}</span></div>`;
  }).join("");
  {const rt=document.getElementById("rrTitle");if(rt)rt.textContent=title||"KARTU RUN INI";}
  pop.classList.add("show");
}

/* =============== DECK =============== */
let filter="ALL", deckSearch="", raidSearch="", dpSearch="";
function runCardSearch(inp, grid, nr){
  if(!inp||!grid)return;
  const q=(inp.value||"").trim().toLowerCase();
  let vis=0;
  grid.querySelectorAll("[data-name]").forEach(el=>{const hit=!q||(el.getAttribute("data-name")||"").indexOf(q)>=0;el.style.display=hit?"":"none";if(hit)vis++;});
  if(nr)nr.style.display=vis?"none":"block";
}
function openModal(id){
  const s=state.stacks.find(x=>x.id===id);if(!s)return;
  const c=CARDS[s.char],st=cardStats(s.char,s.mut,s.trait,s.shiny);
  const m=document.getElementById("modal");
  const mcEl=document.getElementById("md-card");mcEl.dataset.tier=s.tier;
  mcEl.innerHTML=`
    <span class="md-art"><img src="${c.sprite_asset}" alt="${c.name}"></span>
    <div class="md-info">
      <div class="eyebrow" style="color:${TIER_COLOR[s.tier]}">${rarityText(s.tier,luckChance(s.char,s.mut,s.shiny))}${s.mut&&s.mut!=="none"?` · ${mutChip(s.mut,`<span>${mutBadge(s.mut)}</span>`)}`:""}${s.shiny?' · <span class="shiny-badge">SHINY</span>':""}</div>
      <div class="md-name">${c.name}</div>
      <div class="cr-title" style="margin-bottom:8px">${c.type}</div>
      <div class="cr-stats"><span>♡ ${fmt(st.hp)}</span><span>${ATKIC} ${fmt(st.atk)}</span></div>
      <div class="cr-skill" style="margin-bottom:4px"><span class="ds-skill-badge">✦ ${c.passive.name}<span class="sk-txt">${skillText(s.char)}</span></span></div>
      <div class="md-actions">
        <button class="md-btn primary" id="md-use">${(function(){const di=state.deck.indexOf(s.id);return di>=0?("DI DEK · SLOT "+(di+1)):"PASANG KE DEK";})()}</button>
        <button class="md-btn${s.fav?" on":""}" id="md-fav">${s.fav?"★ FAVORIT":"FAVORIT"}</button>
        <button class="md-btn${s.lock?" on":""}" id="md-lock">${s.lock?"🔒 LOCKED":"LOCK"}</button>
        <button class="md-btn md-close" id="md-close">TUTUP</button>
      </div>
    </div>`;
  m.classList.add("show");
  document.getElementById("md-use").onclick=()=>{sfx.hit();const di=state.deck.indexOf(s.id);if(di>=0){setDeckSlot(di,null);}else{let e=state.deck.indexOf(null);if(e<0)e=0;setDeckSlot(e,s.id);}openModal(id);renderBackpackPanel();};
  document.getElementById("md-fav").onclick=()=>{s.fav=!s.fav;save();openModal(id);renderBackpackPanel();};
  document.getElementById("md-lock").onclick=()=>{s.lock=!s.lock;save();openModal(id);};
  document.getElementById("md-close").onclick=()=>{m.classList.remove("show");renderBackpackPanel();};
}
document.getElementById("modal").addEventListener("click",e=>{
  if(e.target.id==="modal"){document.getElementById("modal").classList.remove("show");renderBackpackPanel();}
});

/* =============== LOBBY =============== */
function hubCardHtml(eq,idAttr){
  if(!eq||!eq.char||!CARDS[eq.char]) return `<div class="hub-center"${idAttr||''}><div class="hc-info"><div class="hc-name">Belum ada kartu</div></div></div>`;
  const tier=CARDS[eq.char].tier;
  const st=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  const mut=(eq.mut&&eq.mut!=='none')?eq.mut:null;
  const trait=(eq.trait&&eq.trait!=='none')?eq.trait:null;
  return `<div class="hub-center${mut?' mut-'+mut:''}${shinyCls(eq)}"${idAttr||''} data-tier="${tier}" style="--tcol:${mut?MUT_COLOR[mut]:TIER_COLOR[tier]}${mut?`;border-color:${MUT_COLOR[mut]}`:''}">
      <div class="hc-img"><img src="${cardImg(eq.char)}" alt="${cardName(eq.char)}"${CARDS[eq.char].pos?` style="object-position:${CARDS[eq.char].pos}"`:''}>
          ${shinyName('span','hc-name-top','hc-name-shine',mut,eq.shiny,cardName(eq.char))}
          <span class="hc-chance" style="color:${TIER_COLOR[tier]}">${rarityText(tier,luckChance(eq.char,eq.mut,eq.shiny))}</span>
          ${(mut||trait||eq.shiny)?`<div class="hc-badges">${eq.shiny?'<span class="shiny-badge">SHINY</span>':''}${mut?mutChip(mut,`<span class="mut-badge" style="border-color:${MUT_COLOR[mut]}">${mutBadge(mut)}</span>`):''}${trait?traitChip(trait,`<span class="hc-trait hc-gem" style="border-color:${TRAIT_COLOR[trait]}">${traitGem(14,trait)}</span>`):''}</div>`:''}
          <div class="skill-overlay"><b>${passiveName(eq.char)}</b><span class="sk-txt">${skillText(eq.char)}</span></div>
        </div>
        <div class="hc-info">
          <div class="hc-skill">${passiveName(eq.char)}</div>
          <div class="hc-desc">${skillText(eq.char)}</div>
          <div class="hc-stats"><div class="hp">♡ ${fmt(st.hp)}</div><div class="atk">${ATKIC} ${fmt(st.atk)}</div></div>
        </div>
    </div>`;
}
/* Tilt 3D + glare buat kartu tengah lobby. Diikat tiap renderLobby (elemen #hubCard baru
   tiap render, jadi listener lama ikut hilang — gak dobel). Skip di perangkat sentuh. */
function initHubTilt(card){
  if(!card || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) return;
  let glare=card.querySelector('.hc-glare');
  if(!glare){glare=document.createElement('div');glare.className='hc-glare';card.appendChild(glare);}
  const MAX=12; let raf=null;
  card.addEventListener('mousemove',(e)=>{
    const r=card.getBoundingClientRect();
    const px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height;
    const rx=((0.5-py)*2*MAX), ry=((px-0.5)*2*MAX);
    if(raf)cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      card.style.transform=`rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      card.style.setProperty('--pf',(px-0.5).toFixed(3));
      card.style.setProperty('--pfy',(py-0.5).toFixed(3));
      glare.style.setProperty('--gx',(px*100).toFixed(1)+'%');
      glare.style.setProperty('--gy',(py*100).toFixed(1)+'%');
      glare.style.opacity='1';
    });
  });
  card.addEventListener('mouseleave',()=>{
    if(raf)cancelAnimationFrame(raf);
    card.style.transform='rotateX(0deg) rotateY(0deg)';
    card.style.setProperty('--pf','0');
    card.style.setProperty('--pfy','0');
    glare.style.opacity='0';
  });
}
function renderLobby(){
  if(state.battle)return renderBattle();
  const eq=equipped();
  const st=eq?cardStats(eq.char,eq.mut,eq.trait,eq.shiny):null;
  const tier=eq?CARDS[eq.char].tier:null;
  app.innerHTML=`
  <div class="lobby-hub">
    <div class="hub-box h-l1 hub-link" id="hubRaid" role="button" title="Masuk Boss Raid"><span class="hb-eyebrow">01</span><img class="hi-ic" src="assets/raid/eternal-dragon-hd.png" alt=""><span class="hb-lbl">BOSS RAID</span></div>
    <div class="hub-box h-l2 hub-link" id="hubTower" role="button" title="Masuk Infinite Tower"><span class="hb-eyebrow">02</span><svg class="tw-ic" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M9 21V9l3-6 3 6v12"/><path d="M9 12h6M9 16h6"/><path d="M5 21V11M19 21V11"/></svg><span class="hb-lbl">INFINITE TOWER</span></div>
    <div class="hub-mid">
    <div class="seam"></div>
    <div class="stage-eyebrow">ACTIVE CARD</div>
    <div class="card-float">${hubCardHtml(eq,' id="hubCard"')}</div>
    ${lobbyPetHtml()}
    <div class="stage-hint"><kbd>KLIK</kbd> UNTUK BUKA BACKPACK</div>
    </div>
    <div class="hub-box h-r1 hub-link" id="hubIndex" role="button" title="Buka Katalog Kartu"><span class="hb-eyebrow">03</span><img class="hi-ic" src="assets/images/icon-index-card.png" alt=""><span class="hb-lbl">INDEX CARD</span></div>
    <div class="hub-box h-r2 hub-link" id="hubTrait" role="button" title="Roll Trait untuk kartu aktif"><span class="hb-eyebrow">04</span><img class="hi-ic" src="assets/images/icon-trait.svg" alt=""><span class="hb-lbl">TRAIT</span></div>
    <div class="hub-box h-mission hub-link" id="missionBtn" role="button" title="Buka daftar misi"><svg class="tw-ic" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 4 6v13l5-2 6 2 5-2V4l-5 2-6-2Z"/><path d="M9 4v13M15 6v13"/></svg><span class="hb-lbl">MISSION</span><span class="mb-sub" id="missionSub"></span></div>
  </div>`;
  const hc=document.getElementById("hubCard");if(hc){hc.onclick=()=>{sfx.hit();toggleBackpack();};initHubTilt(hc);}
  const hi=document.getElementById("hubIndex");if(hi)hi.onclick=()=>{sfx.hit();openIndex();};
  const ht=document.getElementById("hubTrait");if(ht)ht.onclick=()=>{sfx.hit();openTrait();};
  const hr=document.getElementById("hubRaid");if(hr)hr.onclick=()=>{sfx.hit();raidView="hub";location.hash="#/raid";};
  const ht2=document.getElementById("hubTower");if(ht2)ht2.onclick=()=>{sfx.hit();stopTower();location.hash="#/tower";};
  const mb=document.getElementById("missionBtn");if(mb)mb.onclick=()=>{sfx.hit();openMission();};
  const ms=document.getElementById("missionSub");if(ms){const done=CHAPTERS.reduce((a,c)=>a+chapProgMode(c,state.diff),0),tot=CHAPTERS.reduce((a,c)=>a+c.levels.length,0);ms.textContent=done+"/"+tot+" SELESAI";}
}

/* ========== TOGGLE BACKPACK FUNCTION ========== */
function toggleBackpack() {
  const panel = document.getElementById('backpackPanel');
  if (!panel) return;

  const isVisible = panel.style.display !== 'none' && panel.style.display !== '';

  if (isVisible) {
    /* Close: refresh lobby di belakang biar hub card & bench ikut perubahan dek. */
    bpTarget = null;
    bpItemPopClose();
    panel.style.opacity = '0';
    panel.style.transform = 'translate(-50%, -45%) scale(0.95)';
    setTimeout(() => { panel.style.display = 'none'; render(); }, 300);
  } else {
    /* Open */
    renderBackpackPanel();
    panel.style.display = 'flex';

    setTimeout(() => {
      panel.style.opacity = '1';
      panel.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);

    beep(520, 0.1, 'triangle', 0.07);
  }
}

/* =============== BOSS RAID (layar + engine) =============== */
let raid=null, raidView="hub", raidPicked=null;
function stopRaid(){
  if(raid){ if(raid.timer)clearTimeout(raid.timer); raid=null; }
  if(typeof fightTimer!=="undefined"&&fightTimer){ clearTimeout(fightTimer); fightTimer=null; }
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
  if(raidView==="pick")return renderRaidPick();
  if(raidView==="battle")return renderRaidBattle();
  if(raidView==="result")return renderRaidResult();
  if(raidView==="shop")return renderRaidShop();
  renderRaidHub();
}
function renderRaidHub(){
  const b=raidBossOf();
  const tierTok=RAID_TIERS.slice().reverse();
  app.innerHTML=`
  <div class="tw-page rd-page"><div class="tw-hub rd-hub">
    <section class="tw-stage rd-stage">
      <div class="tw-stage-eyebrow">BOSS RAID</div>
      <div class="rd-wm">EX</div>
      <div class="rd-boss">
        <div class="rd-boss-frame"><img src="${b.img}" alt="${b.name}">
          <div class="rd-boss-tag"><span class="rbt-tier">EX TIER</span><span class="rbt-skill">${b.skill.toUpperCase()}</span></div>
        </div>
      </div>
      <div class="tw-stage-hint"><kbd>MASUK</kbd> KURAS HP BOSS DALAM ${RAID_TURNS} TURN</div>
    </section>
    <section class="tw-panel">
      <div>
        <div class="rd-title">${b.name}</div>
        <div class="rd-sub">RAID BOSS &middot; DAMAGE = TOKEN &middot; TOKEN = PERKAKAS</div>
      </div>
      <div class="rd-stats">
        <div class="tbs"><span>TOKEN RAID</span><b>${fmt(state.raidTokens||0)}</b></div>
        <div class="tbs"><span>HP BOSS</span><b>${fmt(b.hp)}</b></div>
        <div class="tbs"><span>BATTLE POWER</span><b>${fmt(b.power)}</b></div>
      </div>
      <div>
        <div class="eyebrow" style="margin-bottom:8px">TINGKAT KESULITAN</div>
        <div class="raid-diff" id="raidDiffRow">${RAID_DIFFS.map(d=>{const unl=raidDiffUnlocked(d.k),on=d.k===state.raidDiff;return `<button class="diff-btn${on?" on":""}${unl?"":" locked"}" data-rd="${d.k}"${on?` style="border-color:${d.color};color:${d.color}"`:""}>${unl?d.l:"&#128274; "+d.l}</button>`;}).join("")}</div>
      </div>
      <div class="rd-tiers">
        ${tierTok.map(t=>`<div class="rd-tier"><span>${t.pct}% DMG</span><b>+${Math.round(t.tokens*(b.rw||1))}</b><i>TOKEN</i></div>`).join("")}
      </div>
      <div class="tw-acts">
        <button class="act go" id="raidGo">
          <span class="amed"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="M19 21l2-2"/></svg></span>
          <span class="atxt"><small>Kuras HP boss</small><b>MASUK RAID</b></span>
        </button>
        <button class="act violet" id="raidShopBtn">
          <span class="amed"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></span>
          <span class="atxt"><small>Belanja token</small><b>TOKO RAID</b></span>
        </button>
        <button class="act cyan" id="raidLobby">
          <span class="amed"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg></span>
          <span class="atxt"><small>Kembali</small><b>LOBBY</b></span>
        </button>
      </div>
      <p class="rd-note">Kuras sebagian HP boss dalam satu percobaan untuk klaim token — makin besar <b>% damage</b>, makin banyak token. Makin sulit tingkatnya, HP boss naik tapi token reward ikut berlipat (<b class="v">×${b.rw||1}</b>). Token dibelanjakan di TOKO RAID.</p>
    </section>
  </div></div>`;
  document.getElementById("raidGo").onclick=()=>{if(!raidDiffUnlocked(state.raidDiff)){raidToast("Tingkat ini masih terkunci.");return;}sfx.hit();raidView="pick";renderRaid();};
  document.getElementById("raidShopBtn").onclick=()=>{sfx.hit();raidView="shop";renderRaid();};
  const rl=document.getElementById("raidLobby");if(rl)rl.onclick=()=>{try{sfx.hit();}catch(e){}location.hash="#/";};
  app.querySelectorAll("[data-rd]").forEach(btn=>btn.onclick=()=>{
    const k=btn.dataset.rd;
    if(!raidDiffUnlocked(k)){raidToast("Selesaikan tingkat "+raidNextUnlock(k)+" dulu untuk buka "+RAID_DIFFS.find(d=>d.k===k).l+".");return;}
    if(state.raidDiff===k)return;state.raidDiff=k;sfx.hit();save();renderRaidHub();
  });
}
function renderRaidPick(){
  const stacks=state.stacks.slice().sort((a,b)=>(b.fav?1:0)-(a.fav?1:0));
  const b=raidBossOf(),df=raidDiffOf();
  app.innerHTML=`
  <div class="rd-page rd-pick">
    <div class="rd-pick-head">
      <button class="rd-pick-back" id="raidPickBack" title="Kembali ke hub raid">&#8592;</button>
      <div class="rd-pick-ttl"><span class="eyebrow">PILIH KARTU RAID</span><b>SATU KARTU vs ${b.name.toUpperCase()}</b></div>
      <div class="rd-pick-boss"><img src="${b.img}" alt="${b.name}"><div class="rpb-i"><span class="rpb-k">BOSS &middot; ${b.diffLabel}</span><span class="rpb-n">${b.name}</span><span class="rpb-hp">HP ${fmt(b.hp)} &middot; ${RAID_TURNS} TURN</span><span class="rpb-df" style="color:${df.color}">${df.l} ×${df.rw||1}</span></div></div>
    </div>
    <label class="card-search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg><input class="card-search" id="raidSearch" type="text" placeholder="Cari kartu…" autocomplete="off"></label>
    <div class="raid-pick-grid" id="raidPickGrid">${stacks.map(s=>{
      const c=CARDS[s.char];
      const shny=s.shiny?'<span class="bpt-shiny">SHINY</span>':'';
      const mut=(s.mut&&s.mut!=='none')?s.mut:null;
      const trait=(s.trait&&s.trait!=='none')?s.trait:null;
      const cnt=(s.count||1)>1?`<span class="bpt-cnt">&times;${fmt(s.count)}</span>`:'';
      const stack=(shny||mut||trait)?`<div class="bpt-top">${shny}${mut?mutChip(mut,`<span class="bpt-mut" style="border-color:${MUT_COLOR[mut]}">${mutBadge(mut)}</span>`):''}${trait?traitChip(trait,`<span class="bpt-gem" style="border-color:${TRAIT_COLOR[trait]}">${traitGem(12,trait)}</span>`):''}</div>`:'';
      return `<div class="bp-tile" data-sid="${s.id}" data-pick="${s.id}" data-name="${c.name.toLowerCase()}" style="--tcol:${TIER_COLOR[s.tier]}"><img src="${cardImg(s.char)}" alt="">${stack}${cnt}<div class="bpt-ctl"><button class="bpt-fav${s.fav?' on':''}" onclick="event.stopPropagation();bpFav('${s.id}');renderRaidPick()" title="Favorit">${s.fav?'★':'☆'}</button><button class="bpt-lock${s.lock?' on':''}" onclick="event.stopPropagation();bpLock('${s.id}');renderRaidPick()" title="Lock">${s.lock?'🔒':'🔓'}</button></div><div class="bpt-name">${c.name}</div></div>`;
    }).join("")}</div>
    <div class="no-result" id="raidSearch-nr">Tidak ada kartu yang cocok dengan pencarian.</div>
  </div>`;
  bpsHoverBind();bpsHoverHide(); /* hover tile -> reveal kartu penuh (stat/passive) kayak tab DECK */
  {const bk=document.getElementById("raidPickBack");if(bk)bk.onclick=()=>{sfx.hit();raidView="hub";renderRaid();};}
  {const rs=document.getElementById("raidSearch");if(rs){rs.value=raidSearch;rs.oninput=()=>{raidSearch=rs.value;runCardSearch(rs,document.getElementById("raidPickGrid"),document.getElementById("raidSearch-nr"));};if(raidSearch)runCardSearch(rs,document.getElementById("raidPickGrid"),document.getElementById("raidSearch-nr"));}}
  app.querySelectorAll("[data-pick]").forEach(btn=>btn.onclick=()=>{
    sfx.hit();raidPicked=state.stacks.find(s=>s.id===btn.dataset.pick)||state.stacks[0];
    raidView="battle";renderRaid();
  });
}
function renderRaidBattle(){
  const b=raidBossOf(), eq=raidPicked||equipped();
  app.innerHTML=`
  <div class="battle-grid raid-stage">
    <div class="me-col"><div class="fighter me${eq&&eq.mut&&eq.mut!=='none'?' mut-'+eq.mut:''}${shinyCls(eq)}" data-tier="${eq?eq.tier:''}" data-char="${eq?eq.char:''}">${meFighterHtml(eq)}</div></div>
    <div class="vs-col"><div class="t">VS</div><div class="s" id="raidTurnLabel">TURN<br>0/${RAID_TURNS}</div></div>
    <div class="me-col foe-side"><div class="fighter foe" data-tier="EX">
      <div class="f-banner"><img src="${b.img}" alt="${b.name}"><div class="f-name">${b.name}</div>
        </div>
      <div class="hpbar"><i id="hpRaid"></i><span id="hpRaidT">${fmt(b.hp)} / ${fmt(b.hp)}</span></div>
      <div class="f-body">
        <div class="f-title">${rarityText(b.tier)} · RAID · ${b.diffLabel}</div>
        <div class="f-skill">${b.skill}</div>
        <div class="stat-row"><div class="stat">♡ ${fmt(b.hp)}</div><div class="stat">${ATKIC} ${fmt(999999)}</div></div>
      </div>
    </div></div>
  </div>`;
  startRaid();
}
function startRaid(){
  const b=raidBossOf(), eq=raidPicked||equipped(), base=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  raid={boss:b,hp:b.hp,max:b.hp,dealt:0,turn:0,cap:RAID_TURNS,atk:base.atk,fx:resolveFx(eq,b.fx||{}),cid:eq.char,over:false,timer:null,domainUsed:false,domainLeft:0,diffKey:b.diffKey,rw:b.rw};
  playFight(()=>{ if(raid&&!raid.over)raid.timer=setTimeout(raidStep,500); });
}
function raidStep(){
  if(!raid||raid.over)return;
  raid.turn++;
  if(raid.turn>raid.cap){ if(raid.hp>0){ raidFinisher(()=>endRaid()); } else { endRaid(); } return; }
  const fx=raid.fx, dmg=Math.round(raid.atk*(fx.dmgMult||1)), id=raid.cid;
  const domainActive=fx.domain&&id==="CH_EX_GOJO"&&Math.random()*100<(fx.domain.chance||100);
  const hits=[1];
  let crit=false,purple=false,ranton=false,barrageN=0,iceBlastN=0;
  if(fx.double&&Math.random()*100<fx.double)hits.push(1);
  if(fx.crit&&Math.random()*100<fx.crit.chance){crit=true;hits[hits.length-1]*=fx.crit.mult;}
  else if(Math.random()*100<BASE_CRIT.chance){crit=true;hits[hits.length-1]*=BASE_CRIT.mult;}
  if(fx.purple&&Math.random()*100<fx.purple.chance){purple=true;crit=true;hits[hits.length-1]*=fx.purple.mult;}
  if(fx.ranton&&Math.random()*100<fx.ranton.chance){ranton=true;crit=true;hits.length=0;const rh=Math.max(1,fx.ranton.hits||5),rm=fx.ranton.mult||1;for(let k=0;k<rh;k++)hits.push(rm);}
  if(fx.barrage&&Math.random()*100<fx.barrage.chance){const n=fx.barrage.min+Math.floor(Math.random()*(fx.barrage.max-fx.barrage.min+1)),bm=fx.barrage.mult||1;hits.length=0;for(let i=0;i<n;i++)hits.push(bm);barrageN=hits.length;}
  if(ranton&&!barrageN)barrageN=hits.length;
  /* ICE BLAST (kartu BOSS): N tembakan @ pct% ATK — pola hits angka polos di raid */
  if(fx.iceBlast&&Math.random()*100<fx.iceBlast.chance){const n=Math.max(1,fx.iceBlast.hits||3),pm=(fx.iceBlast.pct!=null?fx.iceBlast.pct:100)/100;hits.length=0;for(let i=0;i<n;i++)hits.push(pm);iceBlastN=n;barrageN=n;}
  // DOMAIN aktif: serangan jadi 10× barrage @30% ATK
  if(domainActive){hits.length=0;const dn=fx.domain.min||10,dm=(fx.domain.mult!=null?fx.domain.mult:0.3);for(let i=0;i<dn;i++)hits.push(dm);barrageN=dn;crit=false;purple=false;ranton=false;}
  const ariseMode=id==="CH_EX_JINWOO"&&barrageN>=9;
  /* Galaxy Roar = satu semburan laser: seluruh damage ditumpuk ke satu sambaran
     supaya jatuh di menit GALAXY.hit, bukan di awal serangan. */
  const galaxyMode=id==="CH_ETERNAL_DRAGON"&&purple;
  if(galaxyMode){const m=hits[hits.length-1];hits.length=0;hits.push(m);barrageN=0;}
  let total=0;hits.forEach(m=>total+=Math.round(dmg*m));
  anim(".fighter.me","lunge-r");
  const ownSound=id==="CH_EX_GOJO"||id==="CH_EX_MADARA"||id==="CH_EX_JINWOO"||(id==="CH_ETERNAL_DRAGON"&&purple);
  if(!ownSound)swing();
  const setRaidBar=hp=>{const v=Math.max(0,hp);const p=Math.max(0,Math.min(100,v/raid.max*100));const b=document.getElementById("hpRaid");if(b)b.style.width=p+"%";const tt=document.getElementById("hpRaidT");if(tt)tt.textContent=fmt(v)+" / "+fmt(raid.max);};
  /* panjang rantai animasi hit ronde ini, dihitung SINKRON (di depan setTimeout) supaya cabang kematian
     bisa menunggu sambaran terakhir selesai — bukan memotong getar + angkanya lewat guard raid.over */
  const rHstep=domainActive?80:160;
  const rMd=ranton&&id==="CH_EX_MADARA";
  const rChainEnd=(rMd?MADARA_T.slash+Math.max(0,hits.length-1)*MADARA_T.step+40:180+Math.max(0,hits.length-1)*rHstep)+520;
  setTimeout(()=>{
    if(domainActive&&raid&&!raid.over){setTimeout(()=>floatText(".fighter.me","DOMAIN EXPANSION","crit"),220);}
    if(ariseMode&&raid&&!raid.over){floatText(".fighter.foe","ARMY OF SHADOWS","crit");}
    const susStart=(ranton&&id==="CH_EX_MADARA"&&raid&&!raid.over)?MADARA_T.slash:0;
    {
      const hstep=domainActive?80:160;
      const susDelay=susStart;
      const md=ranton&&id==="CH_EX_MADARA";
      const dlyAt=i=> galaxyMode ? GALAXY.hit : md ? (susDelay+i*MADARA_T.step) : (i*hstep+susDelay);
      let rShown=raid.hp+total,rBarEnd=0;const rEndHp=raid.hp;
      const ultBarrage=(domainActive||ariseMode||md);
      const jwLag=(id==="CH_EX_JINWOO"&&barrageN&&!domainActive)?170:0;
      hits.forEach((m,i)=>{
        const dl=dlyAt(i),ft=dl+(md?40:0);
        /* getar DIJARAKI per sambaran (dl), sama seperti story/tower: sebelumnya hit non-Madara digetarkan
           sekaligus di menit yang sama jadi kartu cuma bergetar satu kali untuk 10× damage */
        setTimeout(()=>{if(raid&&!raid.over)anim(".fighter.foe","hit",ultBarrage);},dl+jwLag);
        if(!galaxyMode&&!md&&(domainActive||!purple))setTimeout(()=>playClip(punchAudio),dl);
        const dd=Math.round(dmg*m);rShown-=dd;rBarEnd=Math.max(rBarEnd,ft);const stepHp=Math.max(0,rShown);
        setTimeout(()=>floatText(".fighter.foe","-"+fmt(dd),(crit&&i===hits.length-1)?"crit":""),ft);
        setTimeout(()=>setRaidBar(stepHp),ft);
      });
      setTimeout(()=>setRaidBar(rEndHp),rBarEnd+520);
      if(barrageN>1)setTimeout(()=>floatText(".fighter.foe",(iceBlastN?"ICE BLAST ×":domainActive?"UNLIMITED VOID ×":ariseMode?"ARISE ×":md?"TENSA ×":"CLEAVE ×")+barrageN,"crit"),md?MADARA_T.slash:320);
      else if(hits.length>1&&!ranton)setTimeout(()=>floatText(".fighter.foe","DOUBLE!","crit"),260);
    }
  },180);
  raid.hp-=total;raid.dealt+=total;
  setRaidBar(raid.hp+total);
  const tl=document.getElementById("raidTurnLabel");if(tl)tl.innerHTML="TURN<br>"+raid.turn+"/"+raid.cap;
  if(raid.hp<=0){
    const special=(domainActive||ariseMode||ranton||galaxyMode);
    const killWait=Math.max(rChainEnd, special?(ranton?MADARA_T.total+160:galaxyMode?GALAXY.total:1700):0);
    if(killWait>260){ setTimeout(()=>{if(raid&&!raid.over)endRaid();},killWait); }
    else endRaid();
    return;
  }
  raid.timer=setTimeout(raidStep,ariseMode?2200:domainActive?1900:ranton?MADARA_T.total+260:galaxyMode?GALAXY.total+260:1100);
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
  const pct=Math.round((raid.max-Math.max(0,raid.hp))/raid.max*100);
  const tokens=raidTokenFor(pct,{rw:raid.rw});
  raid.pct=pct;raid.tokens=tokens;
  if(pct>=100&&raid.diffKey){state.raidCleared=state.raidCleared||{};state.raidCleared[raid.diffKey]=true;}
  if(tokens>0){state.raidTokens=(state.raidTokens||0)+tokens;save();renderShell();sfx.win();}else sfx.lose();
  setTimeout(()=>{raidView="result";renderRaid();},2000);
}
function renderRaidResult(){
  const pct=raid?raid.pct:0, tokens=raid?raid.tokens:0, nx=raidNextTier(pct,{rw:raid?raid.rw:1});
  const dLabel=raid?(RAID_DIFFS.find(d=>d.k===raid.diffKey)||{}).l:"";
  app.innerHTML=`
  <div class="tw-page rd-page"><div class="raid-result">
    <div class="eyebrow">HASIL RAID${dLabel?" · "+dLabel:""}</div>
    <div class="rr-title disp${pct>=100?"":" lose"}">${pct>=100?"BOSS TUMBANG":"RAID SELESAI"}</div>
    <div class="rr-pct">Damage ke Boss <b>${pct}%</b></div>
    <div class="rr-token">+${tokens} <span>TOKEN RAID</span></div>
    <div class="rr-tier">${nx?`Butuh ${nx.pct}% damage untuk +${nx.tokens} token.`:"Semua tier terklaim!"}</div>
    <div class="rr-actions"><button class="btn-grad" id="rrAgain">RAID LAGI</button><button class="btn-ghost" id="rrHub">KEMBALI</button></div>
  </div></div>`;
  document.getElementById("rrAgain").onclick=()=>{sfx.hit();raidView="pick";renderRaid();};
  document.getElementById("rrHub").onclick=()=>{raidView="hub";renderRaid();};
}
function stackHas(char,mut){mut=mut||"none";return state.stacks.some(s=>s.char===char&&(s.mut||"none")===mut);}
const RAID_SHOP=[
  {id:"coins",name:"2.000 Coin",cost:5,desc:"Koin untuk roll trait & kebutuhan lain.",apply:()=>{state.coins+=2000;return "+2.000 coin";}},
  {id:"card_edragon",name:"Eternal Dragon",cost:120,desc:"Kartu BOSS eksklusif — beli SEKALI, roll terbuka PERMANEN di semua gacha. Chance dasar 1 in 25 jt · ICE BLAST 50% (3×75% ATK) · immune semua status effect.",card:{char:"CH_ETERNAL_DRAGON",mut:"none"},
    apply:()=>{state.raidShopOwned=state.raidShopOwned||{};state.raidShopOwned.CH_ETERNAL_DRAGON=true;return gmGrantCard("CH_ETERNAL_DRAGON");}},
  {id:"helm-abyss",name:"HELM ABYSS",cost:5000,desc:"Artefak CRAYON V2 — +80 flat & +120% LUCK permanen. Beli SEKALI, langsung masuk Backpack (slot artefak, equip 2 slot).",effect:"+80 FLAT & +120% LUCK",owned:()=>state.artOwned.includes("helm-abyss"),
    apply:()=>{state.artOwned=state.artOwned||[];if(!state.artOwned.includes("helm-abyss"))state.artOwned.push("helm-abyss");return "HELM ABYSS · +80 FLAT & +120% LUCK";}},
  {id:"nebula-wisp",name:"NEBULA WISP",cost:15000,desc:"Pet CRAYON V2 — +150 flat & +220% LUCK permanen. Beli SEKALI, langsung masuk Backpack (slot pet, equip 1).",effect:"+150 FLAT & +220% LUCK",owned:()=>state.petOwned.includes("nebula-wisp"),
    apply:()=>{state.petOwned=state.petOwned||[];if(!state.petOwned.includes("nebula-wisp"))state.petOwned.push("nebula-wisp");return "NEBULA WISP · +150 FLAT & +220% LUCK";}},
  /* LUCK & SPEED POTION L1-L3 — consumable, harga token sama dgn Toko Inf. */
  {id:"luck1",name:"Luck Potion L1",cost:10,desc:"+3 flat luck selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"+3 FLAT LUCK · 5 MENIT",
    apply:()=>{state.luckPots=state.luckPots||[0,0,0];state.luckPots[0]++;return "LUCK POTION L1";}},
  {id:"luck2",name:"Luck Potion L2",cost:50,desc:"+5 flat luck & +10% luck selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"+5 FLAT & +10% LUCK · 5 MENIT",
    apply:()=>{state.luckPots=state.luckPots||[0,0,0];state.luckPots[1]++;return "LUCK POTION L2";}},
  {id:"luck3",name:"Luck Potion L3",cost:250,desc:"+10 flat luck & +20% luck selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"+10 FLAT & +20% LUCK · 5 MENIT",
    apply:()=>{state.luckPots=state.luckPots||[0,0,0];state.luckPots[2]++;return "LUCK POTION L3";}},
  {id:"speed1",name:"Speed Potion L1",cost:10,desc:"Roll speed +0.2× (≈1.2×) selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"SPEED +0.2× · 5 MENIT",
    apply:()=>{state.speedPots=state.speedPots||[0,0,0];state.speedPots[0]++;return "SPEED POTION L1";}},
  {id:"speed2",name:"Speed Potion L2",cost:50,desc:"Roll speed +0.5× (≈1.5×) selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"SPEED +0.5× · 5 MENIT",
    apply:()=>{state.speedPots=state.speedPots||[0,0,0];state.speedPots[1]++;return "SPEED POTION L2";}},
  {id:"speed3",name:"Speed Potion L3",cost:250,desc:"Roll speed +1.0× (2×) selama 5 menit. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.",effect:"SPEED +1.0× · 5 MENIT",
    apply:()=>{state.speedPots=state.speedPots||[0,0,0];state.speedPots[2]++;return "SPEED POTION L3";}}
];
/* =============== TOKO RAID — layout master-detail ala TOKO INF (.tw-hub) ===============
   Kiri: daftar item (.srow). Kanan: stats token + detail (.sdetail) + tombol beli (.act.go.buyswap).
   Kartu BOSS: status ROLL TERKUNCI/TERBUKA ditampilkan; beli = raidShopOwned[id]=true (permanen). */
function raidShopBuy(id){
  const it=RAID_SHOP.find(x=>x.id===id);if(!it)return;
  const tok=state.raidTokens||0;
  if(tok<it.cost){raidToast("TOKEN KURANG — butuh "+it.cost+" token");return;}
  if(it.card&&stackHas(it.card.char,it.card.mut)){raidToast("Kartu itu sudah ada di Deck kamu");return;}
  if(it.owned&&it.owned()){raidToast("Sudah dibeli — permanen di Backpack");return;}
  state.raidTokens-=it.cost;
  const msg=it.apply();save();sfx.crit();renderShell();
  raidToast(msg+" · −"+it.cost+" token");
  renderRaidShop();
}
function renderRaidShop(){
  const tok=state.raidTokens||0;
  const COIN_IC=`<svg viewBox="0 0 24 24" width="100%" height="100%" style="display:block"><circle cx="12" cy="12" r="10" fill="#E8B33A" stroke="#8a6414" stroke-width="1.5"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="#B4831E" stroke-width="1.2"/><text x="12" y="16.6" text-anchor="middle" font-size="11" font-weight="900" fill="#6b4a08" font-family="Arial">$</text></svg>`;
  const ICO={coins:COIN_IC,card_edragon:`<img src="assets/raid/eternal-dragon-hd.png" onerror="this.parentNode.textContent='🐉'">`,
    "helm-abyss":`<img src="assets/artifacts/abyss-helm.png" onerror="this.parentNode.textContent='🪖'">`,
    "nebula-wisp":`<img src="assets/pets/nebula-wisp.png" onerror="this.parentNode.textContent='🌌'">`,
    luck1:`<img src="assets/images/pot-luck-1.png" onerror="this.parentNode.textContent='🍀'">`,
    luck2:`<img src="assets/images/pot-luck-2.png" onerror="this.parentNode.textContent='🍀'">`,
    luck3:`<img src="assets/images/pot-luck-3.png" onerror="this.parentNode.textContent='🍀'">`,
    speed1:`<img src="assets/images/pot-speed-1.png" onerror="this.parentNode.textContent='⚡'">`,
    speed2:`<img src="assets/images/pot-speed-2.png" onerror="this.parentNode.textContent='⚡'">`,
    speed3:`<img src="assets/images/pot-speed-3.png" onerror="this.parentNode.textContent='⚡'">`};
  const cardItems=RAID_SHOP.filter(x=>x.card);
  const bossTotal=cardItems.length,bossCount=cardItems.filter(x=>bossRollUnlocked(x.card.char)).length;
  const ITEMS=RAID_SHOP.map(it=>({k:it.id,label:it.name.toUpperCase(),sub:it.card?"Kartu BOSS · TIER BOSS · roll permanen setelah beli":it.desc,cost:it.cost,ac:it.card?"#FFFFFF":"#FFD27A",it}));
  if(window.raidShopSel==null||window.raidShopSel>=ITEMS.length)window.raidShopSel=0;
  let swapT=null;
  const renderList=()=>{
    document.getElementById("raidShopList").innerHTML=ITEMS.map((it,i)=>`
      <div class="srow${i===window.raidShopSel?" on":""}" data-i="${i}" style="--ac:${it.ac}">
        <span class="sic${it.it.card?" card":""}">${ICO[it.k]||"🎁"}</span>
        <span class="sinfo"><span class="sname">${it.label}</span></span>
        <span class="scost"><b>${it.cost}</b><span>TOKEN</span></span>
        ${((it.it.card&&stackHas(it.it.card.char,it.it.card.mut))||(it.it.owned&&it.it.owned()))?`<span class="sown">SUDAH DIBELI</span>`:""}
      </div>`).join("");
    document.querySelectorAll("#raidShopList .srow").forEach(r=>r.onclick=()=>{window.raidShopSel=+r.dataset.i;renderList();renderDetail();});
  };
  const renderBuy=()=>{
    const it=ITEMS[window.raidShopSel],btn=document.getElementById("raidShopBuy");
    btn.style.animation="none";void btn.offsetWidth;btn.style.animation="";
    const have=!!(it.it.card&&stackHas(it.it.card.char,it.it.card.mut))||(it.it.owned?it.it.owned():false);
    let small="Beli item ini",big=`BELI — ${it.cost} TOKEN`,dis=false;
    if(have){small=it.it.card?"Sudah dibeli · roll permanen terbuka":"Sudah dibeli · permanen di Backpack";big="SUDAH DIPUNYA";dis=true;}
    else if(tok<it.cost){small="Token tidak cukup";big=`KURANG ${it.cost-tok} TOKEN`;dis=true;}
    btn.disabled=dis;
    btn.innerHTML=`<span class="amed${it.it.card?" card":""}">${ICO[it.k]||"🎁"}</span><span class="atxt"><small>${small}</small><b>${big}</b></span>`;
  };
  const renderDetail=immediate=>{
    const it=ITEMS[window.raidShopSel],box=document.getElementById("raidShopDetail");
    clearTimeout(swapT);
    const paint=()=>{
      box.classList.remove("out");
      const isCard=!!it.it.card;
      const c=isCard?CARDS[it.it.card.char]:null;
      const unlocked=!isCard||bossRollUnlocked(it.it.card.char);
      const cnt=isCard?state.stacks.filter(s=>s.char===it.it.card.char).reduce((n,s)=>n+(s.count||1),0):0;
      box.innerHTML=`
      <div class="sd-head" style="--ac:${it.ac}">
        <span class="sbig${isCard?" boss-art":""}">${ICO[it.k]||"🎁"}</span>
        <span><span class="sd-kicker">${isCard?"KARTU BOSS · TIER "+(c?c.tier:"BOSS"):"TOKEN · LANGSUNG"}</span><div class="sd-name">${it.label}</div></span>
      </div>
      <p class="sd-desc">${it.it.desc}${c?`<br><b class="sd-skill">${c.passive.name}</b> — ${c.passive.desc}`:""}</p>
      <div class="sd-meta" style="--ac:${it.ac}">
        <div class="sd-mrow"><span class="k">HARGA</span><span class="v c">${it.cost} TOKEN RAID</span></div>
        ${isCard?`<div class="sd-mrow"><span class="k">ROLL</span><span class="v ${unlocked?"g":"no"}">${unlocked?"TERBUKA · PERMANEN":"TERKUNCI — BELUM DIBELI"}</span></div>
        <div class="sd-mrow"><span class="k">DIMILIKI</span><span class="v g">${cnt?"×"+cnt:"—"}</span></div>`
        :`<div class="sd-mrow"><span class="k">EFEK</span><span class="v g">${it.it.effect||"+2.000 COIN LANGSUNG"}</span></div>`}
        <div class="sd-mrow"><span class="k">SISA TOKEN</span><span class="v c">${tok} / ${it.cost}</span></div>
      </div>`;
      renderBuy();
    };
    if(immediate||!box.children.length){paint();return;}
    box.classList.add("out");
    swapT=setTimeout(paint,140);
  };
  app.innerHTML=`<div class="tw-page rd-page">
  <div class="tw-hub shop-hub">
    <section class="tw-stage shop-stage">
      <div class="tw-stage-top">
        <button class="backlink" id="raidShopBack">&#8592; KEMBALI KE RAID</button>
        <div class="tw-stage-eyebrow">TOKO RAID</div>
      </div>
      <div class="slist" id="raidShopList"></div>
      <div class="tw-stage-hint"><kbd>TOKEN</kbd> DIDAPAT DARI % DAMAGE BOSS</div>
    </section>
    <section class="tw-panel">
      <div>
        <div class="tw-title">TOKO RAID</div>
        <div class="tw-sub">BELANJA PAKAI TOKEN RAID &middot; KARTU BOSS BUKA ROLL PERMANEN</div>
      </div>
      <div class="tw-stats">
        <div class="tbs acc"><span>TOKEN RAID</span><b>${fmt(tok)}</b></div>
        <div class="tbs vio"><span>BOSS UNLOCKED</span><b>${bossCount}/${bossTotal}</b></div>
      </div>
      <div class="eyebrow">DETAIL ITEM</div>
      <div class="sdetail" id="raidShopDetail"></div>
      <button class="act go buyswap" id="raidShopBuy"></button>
      <p class="tw-note">Dapat token dari Boss Raid: klaim damage 30% &rarr; <b class="v">+5</b>, 50% &rarr; <b class="v">+10</b>, 100% &rarr; <b class="v">+20</b>. Kartu BOSS sekali beli &rarr; roll terbuka <b class="v">selamanya</b> di semua gacha (roll biasa, menara, INTAN ROLL) — sebelum dibeli roll-nya terkunci.</p>
    </section>
  </div></div>`;
  renderList();renderDetail(true);
  const rb=document.getElementById("raidShopBack");if(rb)rb.onclick=()=>{try{sfx.hit();}catch(e){}raidView="hub";renderRaid();};
  const bi=document.getElementById("raidShopBuy");if(bi)bi.onclick=()=>{if(bi.disabled)return;raidShopBuy(ITEMS[window.raidShopSel].k);};
}

/* =============== INDEX CARD (popup) =============== */
const IX_MUTS=["none","gold","rainbow","secret"];
let ixState={q:"",mut:"all",shiny:false,owned:false,sort:"name"};
function openIndex(){
  /* Katalog SEMUA kartu — layout meniru referensi "INDEX!": search di header, toolbar
     chip mutasi + toggle SHINY + OWNED ONLY + sort, grid full-art (nama, centang owned
     x/8, pips mut×shiny, nama+deskripsi skill di atas art), footer strip progres varian
     (segmen per mutasi) -> milestone INTAN ROLL 100K. Klik kartu = detail passive
     lengkap di #skillPop. Filter/sort state disimpan di ixState biar gak reset. */
  idxRewardSync(true);
  ixRender();
  document.getElementById("indexModal").classList.add("show");
  const sx=document.getElementById("ixSearch");
  sx.value=ixState.q;
  sx.oninput=()=>{ixState.q=sx.value.trim().toLowerCase();ixRender();};
  document.getElementById("spClose").onclick=()=>document.getElementById("skillPop").classList.remove("show");
  document.getElementById("skillPop").onclick=(e)=>{if(e.target.id==="skillPop")document.getElementById("skillPop").classList.remove("show");};
}
function ixRender(){
  const P=idxProgress();
  const ownCnt=(c,mut,sh)=>P.owned.has(`${c.char_id}|${mut}|${sh?1:0}`);
  const ownedN=(c,sh)=>IX_MUTS.reduce((n,m)=>n+(ownCnt(c,m,sh)?1:0),0);
  /* --- toolbar: chip mutasi + shiny + owned-only + sort --- */
  /* parse filter sekali: chip "s-*" = mutasi versi SHINY; fmSel = mutasi murni (null = semua) */
  const shChip=ixState.mut.startsWith("s-");
  const fmSel=ixState.mut==="all"?null:ixState.mut.slice(shChip?2:0);
  const fShiny=shChip||ixState.shiny;
  const chip=(k,l,cls)=>`<button class="ix-chip ${cls||""}${ixState.mut===k?' on':''}" type="button" data-mut="${k}">${l}</button>`;
  const toolbar=`<div class="ix-bar">
    <div class="ix-chips">${chip("all","SEMUA","all")}${IX_MUTS.map(m=>chip(m,MUT_LABEL[m]||"MURNI","m-"+m)).join("")}
      ${chip("s-gold",MUT_LABEL.gold+" + SHINY","m-gold shp")}${chip("s-rainbow",MUT_LABEL.rainbow+" + SHINY","m-rainbow shp")}${chip("s-secret",MUT_LABEL.secret+" + SHINY","m-secret shp")}
      <button class="ix-chip shiny${ixState.shiny?' on':''}" type="button" data-shiny="1">SHINY</button></div>
    <span class="ix-sp"></span>
    <button class="ix-tog${ixState.owned?' on':''}" type="button" data-owned="1">✓ OWNED</button>
    <select class="ix-sort" id="ixSort" title="Urutkan">
      <option value="name">Nama</option><option value="tier">Tier</option>
      <option value="own">Varian</option><option value="chance">Chance</option>
    </select></div>`;
  /* --- filter + sort --- */
  const TIER_RANK={R:0,SR:1,SSR:2,UR:3,EX:4,BOSS:5};
  let list=MASTER_CARD_INDEX.filter(c=>{
    if(ixState.q&&!c.name.toLowerCase().includes(ixState.q))return false;
    if(ixState.owned&&!(ownedN(c,false)+ownedN(c,true)))return false;
    /* chip mutasi -> wajib punya varian mutasi itu; chip s-* / toggle SHINY -> wajib varian shiny;
       tanpa chip mutasi + toggle SHINY -> punya varian shiny apa pun. */
    if(fmSel){
      if(!(ownCnt(c,fmSel,fShiny)||ownCnt(c,fmSel,!fShiny)))return false;
    } else if(fShiny&&!ownedN(c,true))return false;
    return true;});
  const T={name:(a,b)=>a.name.localeCompare(b.name),
    tier:(a,b)=>(TIER_RANK[a.tier]??9)-(TIER_RANK[b.tier]??9)||a.name.localeCompare(b.name),
    own:(a,b)=>(ownedN(b,false)+ownedN(b,true))-(ownedN(a,false)+ownedN(a,true))||a.name.localeCompare(b.name),
    chance:(a,b)=>(a.chance==null?1e9:a.chance)-(b.chance==null?1e9:b.chance)||a.name.localeCompare(b.name)};
  list.sort(T[ixState.sort]||T.name);
  /* --- kartu full-art --- */
  const cells=list.map(c=>{
    const any=ownedN(c,false)+ownedN(c,true);
    const anySh=ownedN(c,true)>0;
    /* border = mutasi tertinggi yang DIMILIKI (secret > rainbow > gold);
       belum punya mutasi: warna tier; belum owned sama sekali: abu redup.
       Punya varian shiny owned -> class shiny = holo shimmer. */
    const bestMut=ownCnt(c,"secret",false)||ownCnt(c,"secret",true)?"secret":
      ownCnt(c,"rainbow",false)||ownCnt(c,"rainbow",true)?"rainbow":
      (ownCnt(c,"gold",false)||ownCnt(c,"gold",true))?"gold":null;
    /* chip MUTASI sedang aktif -> border & nama ikut mutasi TERPILIH biar filter
       ke-baca visual (semua kartu tampil dgn gaya chip itu);
       MURNI -> tampilan polos (warna tier); ALL -> mutasi tertinggi milik sendiri. */
    const fm=ixState.mut==="all"?bestMut:fmSel;
    const bc=fm?MUT_COLOR[fm]:(any?(TIER_COLOR[c.tier]||"#9AA6B2"):"#3A3F47");
    const lockBoss=!!(c.raidBoss&&!bossRollUnlocked(c.char_id));
    /* holo shimmer HANYA di tab SEMUA atau lagi di konteks shiny (chip s-* / toggle SHINY);
       tab MURNI/GOLD/RAINBOW/SECRET biasa tampil tanpa shimmer biar kebaca beda. */
    const shFx=anySh&&(ixState.mut==="all"||fShiny);
    const cls=`ix-cell${any?'':' no-own'}${lockBoss?' boss-locked':''}${shFx?' shiny':''}${fm?' m-'+fm:''}`;
    /* gaya kartu lobby: NAMA kiri-atas + chance pill di bawahnya + badge ✓ kanan-atas;
       pips & teks passive dibuang — klik kartu tetap buka skillPop buat detail.
       mut=fm -> nama ikut warna mutasi (rainbow = huruf warna-warni). */
    const nameHtml=shinyName('span','ixc-name','ixc-shine',fm,anySh,c.name);
    return `<button class="${cls}" type="button" data-c="${c.char_id}"${lockBoss?' title="BELUM DIBELI — beli di TOKO RAID untuk buka roll"':''} style="--tc:${TIER_COLOR[c.tier]||'#9AA6B2'};--bc:${bc}">
      <img src="${c.sprite_asset}" alt="${c.name}">
      <span class="ixc-stack">${nameHtml}<span class="ixc-chance"${fmSel&&fmSel!=="none"?` style="color:${MUT_COLOR[fmSel]}"`:""}>1 IN ${fmt(effChance(c.char_id,fmSel||"none",fShiny))}</span></span>
      <span class="ixc-own${any?' on':''}">✓ ${any}/8</span>
    </button>`;}).join("");
  /* --- footer: strip progres SEGMENT per mutasi + milestone INTAN ROLL --- */
  const t=MASTER_CARD_INDEX.length;
  const segs=IX_MUTS.map(m=>{let n=0;for(const c of MASTER_CARD_INDEX)if(ownCnt(c,m,false))n++;
    return `<i title="${MUT_LABEL[m]||'MURNI'} ${n}/${t}" style="--p:${t?Math.round(n/t*100):0}%;--c:${m==='none'?'#9AA6B2':MUT_COLOR[m]}"></i>`;}).join("");
  const pct=P.total?Math.min(100,Math.round(P.count/P.total*100)):0;
  const complete=P.total>0&&P.count>=P.total;
  const next=Math.max(0,IDX_MILESTONE-(P.count%IDX_MILESTONE));
  const strip=`<div class="ix-prog">
    <div class="ixp-col"><div class="ixp-lbl">VARIAN TERKUMPUL</div><div class="ixp-val">${fmt(P.count)}<em> / ${fmt(P.total)}</em></div></div>
    <div class="ixp-track ix-seg" title="${pct}%">${segs}</div>
    <div class="ixp-rw">
      <div class="ixp-rw-t"><span class="ixp-gem">◆</span> INTAN ROLL 100K</div>
      <div class="ixp-rw-s">${complete?"SEMUA VARIAN LENGKAP":"+"+IDX_MILESTONE+" varian = +1 item"}</div>
      <div class="ixp-own">DIMILIKI <b>${fmt(state.intanRolls||0)}</b>${complete?"":` · ${next} varian lagi`}</div>
    </div></div>`;
  document.getElementById("ixToolbar").innerHTML=toolbar;
  document.getElementById("ixBody").innerHTML=(list.length?"":`<div class="ix-empty">Tidak ada kartu yang cocok</div>`)+`<div class="ix-grid">${cells}</div>`;
  document.getElementById("ixFoot").innerHTML=strip;
  const sel=document.getElementById("ixSort");sel.value=ixState.sort;
  sel.onchange=()=>{ixState.sort=sel.value;ixRender();};
  document.querySelectorAll("#ixToolbar .ix-chip[data-mut]").forEach(b=>b.onclick=()=>{ixState.mut=b.dataset.mut;ixRender();});
  const shb=document.querySelector("#ixToolbar [data-shiny]");if(shb)shb.onclick=()=>{ixState.shiny=!ixState.shiny;ixRender();};
  const owb=document.querySelector("#ixToolbar [data-owned]");if(owb)owb.onclick=()=>{ixState.owned=!ixState.owned;ixRender();};
  document.querySelectorAll("#ixBody .ix-cell").forEach(cell=>{
    cell.onclick=()=>{const c=CARDS[cell.dataset.c];if(!c)return;document.getElementById("spName").textContent=c.passive.name;document.getElementById("spDesc").textContent=c.passive.desc;document.getElementById("skillPop").classList.add("show");};
  });
}



/* =============== TRAIT ROLL (popup) =============== */
let traitTarget=null;
let pendingRare=null;
function traitTargetStack(){let s=state.stacks.find(x=>x.id===traitTarget);if(!s){s=equipped();traitTarget=s?s.id:null;}return s;}
function openTrait(){traitTarget=null;pendingRare=null;renderTrait();document.getElementById("traitModal").classList.add("show");}
function closeTrait(){document.getElementById("traitModal").classList.remove("show");hideTraitTip();}
function renderTrait(){
  const b=document.getElementById("trBody");
  if(!state.stacks.length){b.innerHTML=`<p class="sub">Belum ada kartu. Punya kartu dulu lewat Summon.</p>`;return;}
  const tgt=traitTargetStack();
  const hasT=!!(tgt.trait&&tgt.trait!=="none");
  const tt=hasT?TRAIT[tgt.trait]:null;
  const cur=tt?traitChip(tt.k,`<span class="tc-trait" style="color:${tt.color}">${traitGem(16,tt.k)} ${traitLabel(tt.k)}</span>`):`<span class="tc-trait" style="color:var(--muted)">Belum ada trait</span>`;
  const curStat=tt?`ATK +${Math.round((tt.atk-1)*100)}% · HP +${Math.round((tt.hp-1)*100)}%`:"Roll untuk coba peruntungan bonus ATK &amp; HP.";
  const rates=TRAIT_TIERS.filter(t=>t.chance>0).map(t=>{
    const own=tgt.trait===t.k;
    const aPct=Math.round((t.atk-1)*100),hPct=Math.round((t.hp-1)*100);
    const bar=Math.max(2,Math.round((t.chance/55)*1000)/10);
    return `<div class="trr-item${own?" own":""}"${own?` style="box-shadow:inset 0 0 0 1px ${t.color};background:color-mix(in srgb,${t.color} 10%,transparent)"`:""} title="${t.name} · RARITY ${t.rar} · ATK +${aPct}% · HP +${hPct}%">
      <div class="trr-row"><span class="trr-gem" style="color:${t.color}">${traitGem(15,t.k)}</span><span class="trr-name">${t.name}</span>${own?`<em class="trr-flag" style="background:${t.color}">AKTIF</em>`:""}<em class="trr-rar" style="color:${t.color};border-color:${t.color}">${t.rar}</em><em class="trr-pct" style="color:${t.color}">${t.chance}%</em></div>
      <div class="trr-bar"><i style="width:${bar}%;background:${t.color}"></i></div>
    </div>`;}).join("");
  b.innerHTML=`
    <div class="tr-grid">
      <div class="tr-main">
        <div class="tr-cur tr-cur-btn" id="trPickCard" role="button" title="Ganti kartu target dari deck"><img src="${cardImg(tgt.char)}" alt="">
          <div><div class="tc-lbl">KARTU TARGET · TRAIT SEKARANG</div><div class="tc-name">${cardName(tgt.char)}</div><div class="tc-tline">${cur}</div><div class="tc-tstat"${tt?` style="color:${tt.color}"`:""}>${curStat}</div></div>
          <span class="tr-change">GANTI ▸</span></div>
        <div class="tr-btns"><button class="tr-btn tr-roll" id="trRoll" ${state.coins<TRAIT_COST?"disabled":""}>ROLL TRAIT · ${fmt(TRAIT_COST)} COIN</button></div>
        <div class="tr-note">COIN: <b class="tr-coin">${fmt(state.coins)}</b> · Roll memasang trait ke target. Trait langka minta konfirmasi Simpan / Roll.</div>
      </div>
      <div class="tr-rates"><div class="trr-h">DROP RATE</div>${rates}</div>
    </div>`;
  const r=document.getElementById("trRoll");if(r)r.onclick=rollTrait;
  const pc=document.getElementById("trPickCard");if(pc)pc.onclick=()=>openDeckPick();
}
let cardPickCfg=null;
function openDeckPick(cfg){dpSearch="";cardPickCfg=(cfg&&cfg.getSel&&cfg.onPick)?cfg:null;document.getElementById("deckPickModal").classList.toggle("dp-dark",!cardPickCfg);renderDeckPick();document.getElementById("deckPickModal").classList.add("show");}
function closeDeckPick(){document.getElementById("deckPickModal").classList.remove("show");hideTraitTip();cardPickCfg=null;}
function renderDeckPick(){
  const b=document.getElementById("dpBody");
  if(!state.stacks.length){b.innerHTML=`<p class="sub">Deck kosong.</p>`;return;}
  const selId=cardPickCfg?cardPickCfg.getSel():traitTargetStack().id;
  b.innerHTML=`<label class="card-search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg><input class="card-search" id="dpSearch" type="text" placeholder="Cari kartu…" autocomplete="off"></label><div class="dp-grid" id="dpGrid">${state.stacks.map(s=>{
    return `<button class="dp-card${s.id===selId?" sel":""}" data-tid="${s.id}" data-name="${cardName(s.char).toLowerCase()}"${s.mut&&s.mut!=="none"?` style="border-color:${MUT_COLOR[s.mut]}"`:""}>
      <img src="${cardImg(s.char)}" alt="">
      ${(s.mut&&s.mut!=="none")||(s.trait&&s.trait!=="none")?`<span class="dp-badges">${s.mut&&s.mut!=="none"?mutChip(s.mut,`<span class="mut-badge dp-mut" style="border-color:${MUT_COLOR[s.mut]}">${mutBadge(s.mut)}</span>`):""}${s.trait&&s.trait!=="none"?traitChip(s.trait,`<span class="trait-badge dp-gem" style="border-color:${TRAIT_COLOR[s.trait]}">${traitGem(13,s.trait)}</span>`):""}</span>`:""}
      <span class="dp-name">${cardName(s.char)}</span>
    </button>`;}).join("")}</div><div class="no-result" id="dpSearch-nr">Tidak ada kartu yang cocok.</div>`;
  {const dps=document.getElementById("dpSearch");if(dps){dps.value=dpSearch;dps.oninput=()=>{dpSearch=dps.value;runCardSearch(dps,document.getElementById("dpGrid"),document.getElementById("dpSearch-nr"));};if(dpSearch)runCardSearch(dps,document.getElementById("dpGrid"),document.getElementById("dpSearch-nr"));}}
  b.querySelectorAll(".dp-card").forEach(el=>el.onclick=()=>{const tid=el.getAttribute("data-tid");sfx.hit();if(cardPickCfg){cardPickCfg.onPick(tid);}else{traitTarget=tid;closeDeckPick();renderTrait();}});
}
function rollTrait(){
  if(state.coins<TRAIT_COST)return;
  const tgt=traitTargetStack();if(!tgt)return;
  state.coins-=TRAIT_COST;
  const k=rollTraitPick();
  sfx.crit();
  if(TRAIT[k].atk>=1.5){ save(); renderShell(); renderTrait(); showRarePrompt(k); }
  else { tgt.trait=k; save(); renderShell(); renderTrait(); traitNotify(k); }
}
function showRarePrompt(k){
  const t=TRAIT[k];if(!t)return;
  pendingRare=k;
  const b=document.getElementById("rpBody");
  const canRoll=state.coins>=TRAIT_COST;
  b.innerHTML=`
    <div class="rp-rays"></div>
    ${traitGem(78,k,"rp-gem")}
    <div class="rp-kicker">TRAIT LANGKA</div>
    <div class="rp-name" style="color:${t.color}">${t.name}</div>
    <div class="rp-rar" style="color:${t.color}">RARITY ${t.rar}</div>
    <div class="rp-power" style="color:${t.color}">ATK +${Math.round((t.atk-1)*100)}% · HP +${Math.round((t.hp-1)*100)}%</div>
    <div class="rp-fx">${traitFxList(k)}</div>
    <div class="rp-btns">
      <button class="rp-btn rp-save" id="rpSave">SIMPAN</button>
      <button class="rp-btn rp-roll" id="rpRoll" ${canRoll?"":"disabled"}>ROLL LAGI · ${fmt(TRAIT_COST)} COIN</button>
    </div>
    <div class="rp-note">SIMPAN memasang trait ini ke kartu target. ROLL LAGI membuang hasil ini dan mencoba lagi (bayar coin lagi).</div>`;
  const box=document.getElementById("rpBox");box.style.color=t.color;box.style.borderColor=t.color;
  document.getElementById("rarePromptModal").classList.add("show");
  document.getElementById("rpSave").onclick=saveRare;
  const rr=document.getElementById("rpRoll");if(rr)rr.onclick=rerollRare;
}
function closeRarePrompt(){document.getElementById("rarePromptModal").classList.remove("show");}
function saveRare(){const k=pendingRare;const tgt=traitTargetStack();if(tgt&&k)tgt.trait=k;pendingRare=null;closeRarePrompt();save();renderShell();renderTrait();if(k)traitNotify(k);}
function rerollRare(){pendingRare=null;closeRarePrompt();rollTrait();}
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

/* =============== SETTINGS =============== */
function gmGrantCard(charId){
  if(!CARDS[charId])return "kartu tidak dikenal";
  const ex=state.stacks.find(x=>x.char===charId&&x.tier===CARDS[charId].tier&&(x.mut||"none")==="none");
  if(ex){ex.count=(ex.count||1)+1;return `${CARDS[charId].name} ×${ex.count}`;}
  state.stacks.push({id:Math.random().toString(36).slice(2,9),char:charId,tier:CARDS[charId].tier,lv:1,exp:0,fav:false,lock:false,mut:"none",shiny:false,trait:"none",count:1});
  return `${CARDS[charId].name} ditambahkan ke deck`;
}
function renderSettings(){
  const opts=MASTER_CARD_INDEX.map(c=>`<option value="${c.char_id}">${rarityText(c.tier,c.chance)} · ${c.name}</option>`).join("");
  /* BATTLE SPEED: clamp ke unlock level sebelum render panel */
  if(typeof state.battleSpeed!=="number"||state.battleSpeed<1||state.battleSpeed>4)state.battleSpeed=1;
  {const _m=battleSpeedMax();if(state.battleSpeed>_m)state.battleSpeed=_m;}
  app.innerHTML=`
  <div class="eyebrow">PENGATURAN</div>
  <h1>Game <span class="grad-text">Settings</span></h1>
  <div class="panel set-panel gm-panel">
    <div class="set-t">GM PANEL</div>
    <div class="set-d">Tindakan debug untuk melihat efek kartu. Berikan kartu, tambah coin, ubah mutasi, atau buka semua level — langsung tersimpan ke save.</div>
    <div class="gm-row">
      <select id="gmCard" class="gm-select">${opts}</select>
      <button class="gm-btn" id="gmGrant">Berikan</button>
    </div>
    <div class="gm-row">
      <button class="gm-btn" id="gmEx">Grant Gojo + Madara</button>
      <button class="gm-btn" id="gmAll">Buka Semua Kartu</button>
      <button class="gm-btn" id="gmEquip">Equip EX Terakhir</button>
    </div>
    <div class="gm-row">
      <select class="gm-select" id="gmMut">
        <option value="none">MURNI (tanpa glow)</option>
        <option value="gold">GOLD</option>
        <option value="rainbow">RAINBOW</option>
        <option value="secret">SECRET</option>
      </select>
      <label class="gm-check"><input type="checkbox" id="gmShiny"> SHINY</label>
      <button class="gm-btn" id="gmMutApply">Terapkan ke Kartu Aktif</button>
    </div>
    <div class="gm-row">
      <button class="gm-btn" id="gmCoin">+10.000 Coin</button>
      <button class="gm-btn" id="gmLevels">Buka Semua Level</button>
    </div>
    <div class="gm-note" id="gmNote"></div>
  </div>
  <div class="panel set-panel">
    <div class="set-t">BATTLE SPEED</div>
    <div class="set-d">Percepat jeda giliran &amp; serangan saat battle (cerita &amp; Infinite Tower). Terbuka bertahap: <b style="color:var(--text)">2× di LV 25</b>, <b style="color:var(--text)">3× di LV 50</b>, <b style="color:var(--text)">4× di LV 100</b>. Bisa juga diganti cepat lewat tombol speed di tengah layar battle.</div>
    <div class="gm-row" id="bsRow">${[1,2,3,4].map(n=>{const lk=n>battleSpeedMax();return `<button class="gm-btn bs-btn${(!lk&&n===state.battleSpeed)?" bs-on":""}" data-sp="${n}"${lk?" disabled":""}>${n}×${lk?" · LV "+(n===2?25:n===3?50:100):""}</button>`;}).join("")}</div>
    <div class="gm-note" id="bsNote"></div>
  </div>
  <div class="panel set-panel">
    <div class="set-t">INFINITE TOWER</div>
    <div class="set-d">Biasanya kalah di Tower Infinite = run berakhir &amp; kembali ke menu. Aktifkan <b style="color:var(--text)">AUTO RESTART</b> supaya begitu kalah, run baru otomatis dimulai lagi dari Lantai 1 tanpa kembali ke menu.</div>
    <label class="gm-check"><input type="checkbox" id="setAutoTower"> AUTO RESTART DARI LANTAI 1</label>
    <div class="gm-note" id="towerSetNote"></div>
  </div>
  <div class="panel set-panel">
    <div class="set-t">AKUN</div>
    <div class="set-d">Masuk sebagai <b style="color:var(--text)">${currentUser||"-"}</b>. Keluar untuk pindah ke akun lain di browser ini.</div>
    <button class="reset-btn" id="logoutBtn" style="color:var(--cyan);border-color:rgba(20,28,38,.3);background:rgba(20,28,38,.06)">Keluar &amp; Ganti Akun</button>
  </div>
  <div class="panel set-panel">
    <div class="set-t">RESET PROGRES</div>
    <div class="set-d">Hapus SEMUA data save — level, kartu, coin, token raid, dan riwayat battle — lalu mulai ulang dari awal. Tindakan ini tidak bisa dibatalkan.</div>
    <button class="reset-btn" id="resetBtn">Reset Semua &amp; Main Dari Awal</button>
  </div>`;
  document.getElementById("logoutBtn").onclick=logout;
  /* Auto restart Tower Infinite — flag di state.tower.auto (default mati). */
  if(!state.tower)state.tower={best:0};
  const autoCb=document.getElementById("setAutoTower"),towerSetNote=document.getElementById("towerSetNote");
  const towerSetMsg=()=>{towerSetNote.textContent=autoCb.checked?"AUTO RESTART AKTIF — kalah = langsung mulai run baru dari Lantai 1.":"Auto restart mati — kalah = kembali ke menu Tower.";};
  autoCb.checked=state.tower.auto===true;
  towerSetMsg();
  autoCb.onchange=()=>{state.tower.auto=autoCb.checked;save();towerSetMsg();};
  /* BATTLE SPEED — pilihan 1x-4x; 2x/3x/4x terkunci level 25/50/100. */
  const bsNote=document.getElementById("bsNote");
  const bsMsg=()=>{const _m=battleSpeedMax();bsNote.textContent="LEVEL KAMU: "+(state.playerLv||1)+" · SPEED AKTIF: "+state.battleSpeed+"×"+(_m<4?" · Berikutnya terbuka di LV "+(_m===1?25:_m===2?50:100):" · SUDAH MAX");};
  bsMsg();
  document.querySelectorAll("#bsRow .bs-btn").forEach(el=>{el.onclick=()=>{const n=parseInt(el.getAttribute("data-sp"),10);if(!n||n>battleSpeedMax())return;state.battleSpeed=n;save();renderSettings();};});
  const note=msg=>{document.getElementById("gmNote").textContent=msg;};
  const flash=msg=>{note(msg);save();renderShell();};
  document.getElementById("gmGrant").onclick=()=>{const id=document.getElementById("gmCard").value;flash(gmGrantCard(id));};
  document.getElementById("gmEx").onclick=()=>{const a=gmGrantCard("CH_EX_GOJO"),b=gmGrantCard("CH_EX_MADARA");flash(a+" · "+b);};
  document.getElementById("gmAll").onclick=()=>{MASTER_CARD_INDEX.forEach(c=>gmGrantCard(c.char_id));flash("Semua "+MASTER_CARD_INDEX.length+" kartu dibuka");};
  document.getElementById("gmEquip").onclick=()=>{const ex=state.stacks.filter(s=>s.tier==="EX");if(!ex.length){note("Belum punya kartu EX — grant dulu.");return;}state.equippedId=ex[ex.length-1].id;flash("Equipped: "+CARDS[equipped().char].name);};
  document.getElementById("gmMutApply").onclick=()=>{const m=document.getElementById("gmMut").value;const sh=document.getElementById("gmShiny").checked;const eq=equipped();if(!eq){note("Belum ada kartu aktif.");return;}eq.mut=m;eq.shiny=sh;save();note((MUT_LABEL[m]||"MURNI")+(sh?" + SHINY":"")+" dipasang ke "+CARDS[eq.char].name+" — cek Deck untuk lihat efek.");renderShell();};
  document.getElementById("gmCoin").onclick=()=>{state.coins+=10000;flash("Coin +10.000");};
  document.getElementById("gmLevels").onclick=()=>{for(let i=1;i<=LEVEL_COUNT;i++){state.cleared[i]=true;DIFFS.forEach(d=>{diffProg()[d.k][i]=true;});}flash("Semua level terbuka");};
  let armed=false,timer=null;
  const b=document.getElementById("resetBtn");
  const disarm=()=>{armed=false;if(timer){clearTimeout(timer);timer=null;}b.classList.remove("armed");b.textContent="Reset Semua & Main Dari Awal";};
  b.onclick=()=>{
    if(!armed){armed=true;b.classList.add("armed");b.textContent="Yakin? Tap lagi untuk reset";timer=setTimeout(disarm,4000);}
    else{localStorage.removeItem(KEY);location.reload();}
  };
}

/* =============== ROUTER =============== */
function stopBattleLoop(){ if(bt){ if(bt.timer)clearTimeout(bt.timer); bt=null; } if(fightTimer){ clearTimeout(fightTimer); fightTimer=null; } document.getElementById("overlay").classList.remove("show"); }
function render(){
  try {
    hoverHide(); /* safety net: popup hover kartu (deck/picker) disembunyikan tiap ganti view */
    if(!bt&&!raid)document.querySelectorAll("body>.ebfx,body>.eb-flash").forEach(e=>e.remove());
    renderShell();
    const r=route();
    if(r==="#/")renderHome();
    else if(r==="#/raid")renderRaid();
    else if(r==="#/tower")renderTower();
    else if(r==="#/settings")renderSettings();
    else renderLobby();
    document.body.classList.toggle("on-lobby", !state.battle && !!app.querySelector(".lobby-hub"));
    document.body.classList.toggle("on-tower", !state.battle && !!app.querySelector(".tw-page"));
  } catch (e) {
    console.error('Render error:', e);
    document.body.innerHTML = `<div style="padding:40px;color:red"><h1>Error!</h1><p>${e.message}</p><pre>${e.stack}</pre></div>`;
  }
}
/* Semua view battle (story/tower/raid) punya .battle-grid -> pasang mode full-screen.
   Observer dipakai karena sebagian renderer battle dipanggil langsung tanpa lewat render(). */
const bfSync=()=>{
  if(!app) return; // Guard: kalau app belum ready, skip
  const grid = app.querySelector(".battle-grid");
  const hasBattle = !!grid;
  document.body.classList.toggle("battle-full", hasBattle);
  // Topbar HUD tetap tampil saat battle (biar nggak sepi); arena pakai sisa tinggi di bawahnya.
  if(hasBattle){ const tb=document.getElementById("topbar"); if(tb) document.documentElement.style.setProperty("--tbh", Math.round(tb.getBoundingClientRect().height)+"px"); }
  // Tombol END khusus Infinite Tower; story & raid boss auto-complete jadi nggak perlu tombol.
  document.body.classList.toggle("battle-tower", !!(grid && grid.classList.contains("tower-stage")));
  document.body.classList.toggle("on-lobby", !hasBattle && !!app.querySelector(".lobby-hub"));
  document.body.classList.toggle("on-tower", !hasBattle && !!app.querySelector(".tw-page"));
};
/* Latar arena battle di-inject sekali ke <body> (bukan #app, biar nggak kehapus tiap render).
   CSS nge-gate tampilnya cuma saat body.battle-full, jadi di luar battle dia tak kelihatan. */
(function mountArena(){
  if(document.querySelector(".battle-arena"))return;
  const a=document.createElement("div");
  a.className="battle-arena";a.setAttribute("aria-hidden","true");
  a.innerHTML='<div class="ar-sky"></div><div class="ar-floor"></div><div class="ar-horizon"></div><div class="ar-spot me"></div><div class="ar-spot foe"></div><div class="ar-speed"></div><div class="ar-seam"></div><div class="ar-vig"></div>';
  document.body.appendChild(a);
})();
if(app){
  try {
    new MutationObserver(bfSync).observe(app,{childList:true,subtree:true});
  } catch(e) {
    console.warn('MutationObserver failed:', e.message);
  }
}
document.getElementById("bfExit").onclick=()=>{
  sfx.hit();
  stopBattleLoop();stopRaid();stopTower();state.battle=null;closeStory();
  document.getElementById("overlay").classList.remove("show");
  if(route()==="#/lobby")render();else location.hash="#/lobby";
};
document.getElementById("mxClose").onclick=()=>{sfx.hit();closeMission();};
document.getElementById("missionModal").onclick=(e)=>{if(e.target.id==="missionModal")closeMission();};
document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{
  stopBattleLoop();stopRaid();stopTower();state.battle=null;closeStory();
  if(location.hash===b.dataset.route||(!location.hash&&b.dataset.route==="#/lobby"))render();
  else location.hash=b.dataset.route;
});
/* ===== MODE MOBILE: layar penuh + kunci landscape (khusus perangkat sentuh) =====
   #fsBtn ikut ke-select loop .nav-btn di atas (nggak punya data-route) -> onclick-nya
   kita TIMPA di sini (blok ini jalan setelah loop) biar nggak nyetel location.hash=undefined. */
(function(){
  const root=document.documentElement;
  const isFs=()=>!!(document.fullscreenElement||document.webkitFullscreenElement||document.mozFullScreenElement||document.msFullscreenElement);
  function reqFs(el){
    if(el.requestFullscreen) return el.requestFullscreen();
    if(el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if(el.mozRequestFullScreen) return el.mozRequestFullScreen();
    if(el.msRequestFullscreen) return el.msRequestFullscreen();
    return Promise.reject(new Error("no-fs"));
  }
  function exitFs(){
    if(document.exitFullscreen) return document.exitFullscreen();
    if(document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if(document.mozCancelFullScreen) return document.mozCancelFullScreen();
    if(document.msExitFullscreen) return document.msExitFullscreen();
  }
  function lockLandscape(){
    try{ const o=screen.orientation||screen.mozOrientation; if(o&&o.lock) return o.lock("landscape"); }catch(e){}
    return Promise.reject(new Error("no-lock"));
  }
  function updateIcon(){
    const b=document.getElementById("fsBtn"); if(!b) return;
    b.classList.toggle("active",isFs());
    b.title=isFs()?"Keluar layar penuh":"Layar penuh";
  }
  async function enterFs(){
    try{ await reqFs(root); }catch(e){}
    try{ await lockLandscape(); }catch(e){}   // iOS gagal -> rotasi manual tetap jalan via overlay CSS
    updateIcon();
  }
  function toggleFs(){ if(isFs()){ try{ exitFs(); }catch(e){} } else { enterFs(); } updateIcon(); }
  const fsBtn=document.getElementById("fsBtn");
  if(fsBtn) fsBtn.onclick=(e)=>{ e.preventDefault(); e.stopPropagation(); if(typeof sfx!=="undefined"&&sfx.hit)sfx.hit(); toggleFs(); };
  const ovBtn=document.getElementById("fsBtnOverlay");
  if(ovBtn) ovBtn.onclick=(e)=>{ e.preventDefault(); if(typeof sfx!=="undefined"&&sfx.hit)sfx.hit(); enterFs(); };
  ["fullscreenchange","webkitfullscreenchange","mozfullscreenchange","MSFullscreenChange"].forEach(ev=>document.addEventListener(ev,updateIcon));
  updateIcon();
})();
/* ===== Dock roll + backpack (elemen statis di <body>): wiring SEKALI saja.
   Elemen ini tidak ikut di-render-ulang, jadi interval roll tetap hidup
   walau player pindah layar / membuka backpack -> AFK aman. ===== */
(function wireRollDock(){
  const rb=document.getElementById("rollBtn");
  if(rb)rb.addEventListener("click",()=>{
    /* Opsi 1: satu klik = satu roll. Kartu di-reveal sebentar, lalu overlay nutup sendiri (bukan loop).
       Kunci selama reveal tampil biar gak bisa di-spam. */
    if(rollState.hideTimer)return;
    if(rollState.active)stopRollAnimation();
    if(rollState.hideTimer){clearTimeout(rollState.hideTimer);rollState.hideTimer=null;}
    const result=rngRoll(1,1);
    if(!result){beep(220,0.15,"square",0.08);return;}
    grantRolledCard(result.cardId, result.mut, result.shiny);
    showRollResult(result);
    beep(440,0.15,"sine",0.1);
    rollState.hideTimer=setTimeout(()=>{hideRollResult();rollState.hideTimer=null;},1600);
  });
  const bt=document.getElementById("backpackToggle");
  if(bt)bt.addEventListener("click",toggleBackpack);
  // Event handler: klik avatar → buka modal profil
  const av=document.getElementById("profAv");if(av){av.onclick=function(e){e.stopPropagation();openProfileModal();};}
  const fav=document.getElementById("footAv");if(fav){fav.onclick=function(e){e.stopPropagation();openProfileModal();};}
  const bd=document.getElementById("profBackdrop");if(bd)bd.onclick=closeProfileModal;
  const pc=document.getElementById("profClose");if(pc)pc.onclick=function(e){e.stopPropagation();closeProfileModal();};
  /* AUTO: toggle rolling terus-menerus. Klik lagi / Tutup / klik dadu = mati. */
  const ra=document.getElementById("rollAutoBtn");
  if(ra)ra.addEventListener("click",()=>{
    if(rollState.active){stopRollAnimation();hideRollResult();beep(330,0.12,"square",0.08);}
    else{startRollAnimation();beep(440,0.15,"sine",0.1);}
  });
  const rmin=document.getElementById("rollMinBtn");
  if(rmin)rmin.addEventListener("click",e=>{e.stopPropagation();setRollMini(true);});
  const rshow=document.querySelector("#rollOverlay .roll-card-showcase");
  if(rshow)rshow.addEventListener("click",()=>{if(rollState.mini&&!rollState.collapsed)setRollMini(false);});
  const rstrip=document.getElementById("rollMiniStrip");
  if(rstrip)rstrip.addEventListener("click",e=>{e.stopPropagation();if(!rollState.mini)return;rollState.collapsed=!rollState.collapsed;syncRollMiniStrip();beep(rollState.collapsed?330:440,0.08,"sine",0.06);});
  /* Tutup lewat kontrol "✕ Tutup" atau klik area gelap di LUAR kartu — kartu sendiri (area badge/chance) tidak menutup. */
  const rov=document.getElementById("rollOverlay");
  if(rov)rov.addEventListener("click",e=>{
    if(rollState.mini)return;
    if(e.target===rov||e.target.closest("#rollCloseBtn")){stopRollAnimation();hideRollResult();beep(330,0.12,"square",0.08);}
  });
})();
document.getElementById("ixClose").onclick=()=>document.getElementById("indexModal").classList.remove("show");document.getElementById("indexModal").addEventListener("click",e=>{if(e.target.id==="indexModal")e.target.classList.remove("show");});
document.getElementById("trClose").onclick=closeTrait;document.getElementById("traitModal").addEventListener("click",e=>{if(e.target.id==="traitModal")closeTrait();});
document.getElementById("dpClose").onclick=closeDeckPick;document.getElementById("deckPickModal").addEventListener("click",e=>{if(e.target.id==="deckPickModal")closeDeckPick();});
document.getElementById("dlClose").onclick=closeDaily;
document.getElementById("dailyModal").addEventListener("click",e=>{if(e.target.id==="dailyModal")closeDaily();});
document.getElementById("stClose").onclick=closeStart;
document.getElementById("startModal").addEventListener("click",e=>{if(e.target.id==="startModal")closeStart();});
document.getElementById("smClose").onclick=closeStory;
document.getElementById("storyModal").addEventListener("click",e=>{if(e.target.id==="storyModal")closeStory();});
window.addEventListener("hashchange",()=>{stopBattleLoop();stopRaid();stopTower();if(route()!=="#/")state.battle=null;closeStory();render();});

/* =============== AUTH + BOOT =============== */
let authMode="login";
function setAuthMode(m){
  authMode=m;
  document.getElementById("tabLogin").classList.toggle("active",m==="login");
  document.getElementById("tabRegister").classList.toggle("active",m==="register");
  document.getElementById("auSubmit").textContent=m==="login"?"MASUK":"DAFTAR";
  document.getElementById("auErr").textContent="";
}
function auError(msg){document.getElementById("auErr").textContent=msg;}
function submitAuth(){
  const btn=document.getElementById("auSubmit");
  const name=document.getElementById("auUser").value.trim();
  const pass=document.getElementById("auPass").value;
  auError("");
  if(name.length<3){auError("Username minimal 3 karakter.");return;}
  if(/\s/.test(name)){auError("Username tidak boleh ada spasi.");return;}
  if(pass.length<3){auError("Password minimal 3 karakter.");return;}
  btn.disabled=true;btn.classList.add("press");
  document.getElementById("asTxt").textContent=authMode==="register"?"Mendaftarkan…":"Memasuki arena…";
  document.getElementById("authSpin").classList.remove("hidden");
  setTimeout(()=>{
    const finish=()=>{document.getElementById("authSpin").classList.add("hidden");btn.disabled=false;btn.classList.remove("press");};
    const users=getUsers(), key=name.toLowerCase();
    if(authMode==="register"){
      if(users[key]){auError("Username itu sudah dipakai. Coba masuk.");finish();return;}
      users[key]={name,pass:hashPass(pass),created:Date.now()};
      saveUsers(users);
      finish();
      document.getElementById("auPass").value="";
      document.getElementById("adTitle").textContent="Akun berhasil dibuat";
      document.getElementById("adMsg").textContent="Silakan masuk sebagai "+name+".";
      document.getElementById("authDone").classList.remove("hidden");
    }else{
      const u=users[key];
      if(!u){auError("Akun belum terdaftar. Silakan daftar dulu.");finish();return;}
      if(u.pass!==hashPass(pass)){auError("Password salah.");finish();return;}
      finish();
      enterGame(u.name,true);
    }
  },700);
}
document.getElementById("adOk").onclick=()=>{
  document.getElementById("authDone").classList.add("hidden");
  setAuthMode("login");
};
document.getElementById("wlOk").onclick=()=>{
  document.getElementById("welcomeModal").classList.add("hidden");
  location.hash="#/lobby";
  render();
};
/* klik area gelap di sekitar popup = tutup juga, supaya tidak ada jalan buntu kalau tombolnya tidak terjangkau */
document.getElementById("welcomeModal").addEventListener("click",e=>{if(e.target.id==="welcomeModal")document.getElementById("welcomeModal").classList.add("hidden");});
function enterGame(name,welcome){
  currentUser=name;
  localStorage.setItem(SESSION_KEY,name);
  try {
    loadStateFor(name);
    save();
    idxRewardSync(true); /* klaim retroaktif index reward varian lama (tanpa toast boot) */
  } catch(e) {
    console.error('loadStateFor FAILED:', e.message, e.stack);
    state=freshState();
    save();
  }
  runLoading(()=>{
    try {
      document.getElementById("authScreen").classList.add("hidden");
      document.getElementById("loadingScreen").classList.add("hidden");
      location.hash="#/lobby";
      render();
      if(welcome){
        document.getElementById("wlMsg").textContent="Selamat datang, "+name+"!";
        document.getElementById("welcomeModal").classList.remove("hidden");
      }
    } catch(e) {
      console.error('Post-login render FAILED:', e.message, e.stack);
      document.getElementById("loadingScreen").classList.add("hidden");
      document.getElementById("authScreen").classList.add("hidden");
      document.getElementById("app").innerHTML='<div style="padding:40px;color:red"><h1>Render Error</h1><pre>'+e.message+'<br>'+e.stack+'</pre></div>';
    }
  });
}
function runLoading(done){
  const scr=document.getElementById("loadingScreen");
  document.getElementById("authSpin").classList.add("hidden");
  const fill=document.getElementById("ldFill");
  const status=document.getElementById("ldStatus");
  scr.classList.remove("hidden");
  const steps=["Menyinkronkan data…","Membangun deck…","Menyiapkan arena…","Memuat dunia…","Siarp!"];
  const dur=3000,t0=Date.now();
  fill.style.width="0%";
  let completed=false;
  const iv=setInterval(()=>{
    const p=Math.min(1,(Date.now()-t0)/dur);
    fill.style.width=(p*100).toFixed(1)+"%";
    status.textContent=steps[Math.min(steps.length-1,Math.floor(p*steps.length))];
    if(p>=1&&!completed){completed=true;clearInterval(iv);setTimeout(done,250);}
  },60);
  // Timeout guard - force through after 8 seconds
  setTimeout(()=>{
    if(!completed){
      completed=true;
      console.warn('Loading timeout, forcing through...');
      clearInterval(iv);
      setTimeout(done,250);
    }
  },8000);
}
function logout(){
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}
function boot(){
  document.getElementById("loadingScreen").classList.add("hidden");
  document.getElementById("authScreen").classList.remove("hidden");
  document.getElementById("tabLogin").onclick=()=>setAuthMode("login");
  document.getElementById("tabRegister").onclick=()=>setAuthMode("register");
  document.getElementById("auSubmit").onclick=submitAuth;
  ["auUser","auPass"].forEach(id=>document.getElementById(id).addEventListener("keydown",e=>{if(e.key==="Enter")submitAuth();}));
  const s=localStorage.getItem(SESSION_KEY), users=getUsers();
  const last=(s&&users[s.toLowerCase()])?users[s.toLowerCase()].name:"";
  setAuthMode(Object.keys(users).length?"login":"register");
  if(last){document.getElementById("auUser").value=last;document.getElementById("auPass").focus();}
  
  /* ========== Roll + Deck badge init ========== */
  rollCountBadge();
  if(window.videoBoot) window.videoBoot();
}

setTimeout(() => { boot(); }, 0);
/* Auto-fit nama kartu: kecilkan font .hc-name-top seperlunya (12→10px) supaya nama panjang muat 1 baris tanpa kepotong/wrap. */
function fitNameEl(el){
  if(!el||el.nodeType!==1)return;
  const txt=el.textContent||"";
  if(el.dataset.fitFor===txt)return;           // sudah di-fit untuk teks ini
  el.dataset.fitFor=txt;
  el.style.fontSize="";
  let fs=12;
  while(fs>10&&el.scrollWidth>el.clientWidth+1){fs--;el.style.fontSize=fs+"px";}
}
const FIT_NAME_SEL=".hc-name-top,.f-name";
(function(){
  const app=document.getElementById("app");
  if(app&&window.MutationObserver){
    new MutationObserver(muts=>{
      for(const m of muts){
        for(const n of m.addedNodes){
          if(n.nodeType!==1)continue;
          if(n.matches&&n.matches(FIT_NAME_SEL))fitNameEl(n);
          if(n.querySelectorAll)n.querySelectorAll(FIT_NAME_SEL).forEach(fitNameEl);
        }
      }
    }).observe(app,{childList:true,subtree:true});
  }
})();
