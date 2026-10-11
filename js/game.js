"use strict";
/* =============== DATA =============== */
/* UR = setingkat di bawah EX & TIDAK ada di gacha (hanya Toko Raid), jadi dia tidak punya baris DROP_RATES */
const TIERS=["R","SR","SSR","UR","EX"];
const TIER_COLOR={R:"#9A8A8B",SR:"#C8A2A8",SSR:"#B07A9B",UR:"#2F8FE2",EX:"#FF4D5E"};
/* TIER = 100% KOSMETIK (warna badge + label). Tidak menentukan drop chance, stat scaling, atau pool.
   Chance tiap kartu di-set manual di field `chance:`. Kalau kartu tidak punya `chance:`, fallback ke
   TIER_CHANCE di bawah (nilai tengah tiap band, supaya card tanpa override tetap masuk akal).
   Bands (batas bawah inklusif): R < 50k ≤ SR < 500k ≤ SSR < 5jt ≤ UR < 500jt ≤ EX. */
const TIER_CHANCE={R:5000,SR:250000,SSR:2500000,UR:50000000,EX:1000000000};
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
   Artefak: beli pakai coin, equip maks 2 slot. Pet: beli pakai coin, equip 1. */
const ART_DEFS=[
  {id:"manik", name:"MANIK REZEKI",       icon:"manik", color:"#5eead4", price:10000000, flat:5,  pct:0},
  {id:"medal", name:"MEDAL KEBERUNTUNGAN",icon:"medal", color:"#fcd34d", price:20000000, flat:10, pct:10},
  {id:"giok",  name:"GIOK HOKI",          icon:"giok",  color:"#4ade80", price:35000000, flat:25, pct:0},
  {id:"batu",  name:"BATU UNTUNG",        icon:"batu",  color:"#7DF9FF", price:50000000, flat:0,  pct:25},
  {id:"cincin",name:"CINCIN ES",          icon:"cincin",color:"#93c5fd", price:70000000, flat:50, pct:30},
  {id:"intan", name:"INTAN KUASA",        icon:"intan", color:"#f0abfc", price:100000000,flat:75, pct:75}
];
const PET_DEFS=[
  {id:"doll",        name:"BONEKA TERKUTUK",img:"assets/pets/doll.jpg",        emoji:"🎎",price:10000000, flat:10, pct:0},
  {id:"otherworldly",name:"MAKHLUK LAIN",   img:"assets/pets/otherworldly.jpg",emoji:"👾",price:20000000, flat:25, pct:0},
  {id:"titan",       name:"TITAN BUAS",     img:"assets/pets/titan.jpg",       emoji:"🗿",price:35000000, flat:50, pct:0},
  {id:"dragon",      name:"DRAGON ABADI",   img:"assets/pets/dragon.jpg",      emoji:"🐉",price:50000000, flat:0,  pct:15},
  {id:"nine-tail",   name:"EKOR SEMBILAN",  img:"assets/pets/nine-tail.jpg",   emoji:"🐺",price:70000000, flat:50, pct:25},
  {id:"bijuu",       name:"BIJUU",          img:"assets/pets/bijuu.jpg",       emoji:"🦊",price:100000000,flat:100,pct:50}
];
function luckTxt(d){const a=[];if(d.flat)a.push("+"+d.flat+" FLAT");if(d.pct)a.push("+"+d.pct+"%");return a.join(" & ")+" LUCK";}
function artLuckFlat(){return state&&Array.isArray(state.artOwned)?state.artOwned.reduce((a,id)=>a+((ART_DEFS.find(x=>x.id===id)||{}).flat||0),0):0;}
function artLuckPct(){return state&&Array.isArray(state.artOwned)?state.artOwned.reduce((a,id)=>a+((ART_DEFS.find(x=>x.id===id)||{}).pct||0),0):0;}
function petLuckFlat(){const d=state&&state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;return d?(d.flat||0):0;}
function petLuckPct(){const d=state&&state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;return d?(d.pct||0):0;}
function totalLuck(){const p=state?.player||{};const base=p.luckBase??p.luck??1;const flat=(p.luckFlat||0)+treeLuckFlat()+activeLuckBuff()+artLuckFlat()+petLuckFlat();const pct=(p.luckPercent||0)+treeLuckPct()+artLuckPct()+petLuckPct();return (base+flat)*(1+pct)*weatherLuckMult();}
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
       {id:"CH_...", name:"Nama", tier:"R"|"SR"|"SSR"|"UR"|"EX", type:"Offensive",
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
           transform:{mult}     -> permanen sejak masuk arena: HP & ATK ×mult (gak ada expiry, beda sama burst).
           wallTitans:{every,pct} -> tiap `every` giliran sejak masuk, sambaran BONUS sebesar pct% ATK ke musuh (di luar serangan normal).
           rumbling:{turns,pct}  -> saat kartu ini MATI (bukan revive/lastStand), musuh kena DoT pct% max HP-nya selama `turns` giliran berikutnya, terus jalan walau kartu udah ganti.
           bungeeGum:{turns,bonus} -> tiap kali kartu ini KENA SERANG musuh, tempel "gum" ke musuh selama `turns` giliran; selama gum aktif semua serangan kartu ini ×(1+bonus/100) damage. Gum ikut pindah ke musuh berikutnya kalau yang kena gum mati (counter `bt.gumTurns` di sisi musuh).
           snatch:{pct} -> tiap kali kartu ini MENGALAHKAN kartu musuh (foeDown), curi permanen pct% ATK & pct% max HP musuh yang mati lalu tambah ke stat kartu ini (flat, persist antar tag-in via `bt.snatchAtk[a]`/`bt.snatchHp[a]`).
           arise:{pct,turns} -> (Shadow Monarch) saat kartu ini membunuh DAN masih ada gelombang musuh berikutnya (menara), bangkitkan musuh yang mati sebagai BAYANGAN dengan pct% ATK & HP-nya. Bayangan MENGAMBIL-ALIH slot kartu ini (HP asli disimpan di `bt.shadow.retHp/retMax`), menyerang dengan atk bayangan (passive Monarch dimatikan: `fx={}` selama possess) selama `turns` giliran ATAU sampai bayangan tumbang (trySave → endPossession, Monarch balik utuh). State: `bt.shadow`.
           prideOfPrince:{pct} -> (Royal Vanguard) tiap KARTU PARTY JATUH (di `trySave`, setelah revive/lastStand gagal), semua kartu di `bt.fighters` yang punya fx ini dapat `bt.atkBuff[i]+=pct` (permanen buat sisa battle, numpuk). `atkBuff` dipakai playerPhase `atk*(1+atkBuff/100)` — jadi pas Vanguard aktif dia udah lebih kuat. Jalan walau Vanguard lagi nunggu di bench (buff nyimpen di index-nya).
           regression:{hpPct} -> (Regressor) kill-banked revive. Tiap Regressor BUNUH musuh (di `foeDown`, blok yang sama dgn snatch/arise): `bt.regressCharges[a]++`. Di `trySave` (SETELAH cek shadow, SEBELUM fx.revive): kalau `fx.regression && bt.regressCharges[a]>0` → `regressCharges[a]--`, `bt.pHp=round(bt.pMax*hpPct/100)`, lalu "skill di-refresh" (reset revUsed/standUsed/burstStart=turn/dodgeCount/atkCount/wtCount, re-arm entryGuard/execGuard). return true (bangkit di tempat, gak tag-in). Tiap kebangkitan "bayar" 1 kill → gak abadi. Butuh kill dulu = butuh mode multi-musuh (menara); story 1 musuh gak bisa demo.
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
    /* ===== KARTU EKSKLUSIF WEATHER: 2 per cuaca (1 UR + 1 EX) = 8 total.
       Hanya bisa ke-roll saat weather-nya AKTIF (lihat WEATHERS + activeWeatherId).
       4 kartu UR baru = PLACEHOLDER struktur — art & passive final diganti
       sesuai kiriman user (timpa field art/fx/desc/hp/atk/chance di entri ini). ===== */
    {id:"CH_STORM_HERALD",name:"STORM HERALD",tier:"UR",type:"Tempest",skill:"THUNDERCALL",hp:2100,atk:1050,chance:12000000,art:"assets/cards/art/moon-blade.webp",pos:"center",weatherOnly:"storm",
      fx:{everySecond:{mult:1.4}},
      desc:"(Eksklusif cuaca BADAI) Pembawa badai yang sambarannya berlipat tiap giliran genap."},
    {id:"CH_TEMPEST_TYRANT",name:"TEMPEST TYRANT",tier:"EX",type:"Tempest",skill:"STORM JUDGMENT",hp:2400,atk:1250,chance:20000000,art:"assets/cards/art/awakened-galactic-tyrant.png",pos:"center",weatherOnly:"storm",
      fx:{barrage:{chance:30,min:2,max:4,mult:1.4}},
      desc:"(Eksklusif cuaca BADAI) Tyrant badai yang 30% peluang melepas 2-4 sambaran beruntun."},
    {id:"CH_ASTRAL_SEER",name:"ASTRAL SEER",tier:"UR",type:"Seer",skill:"STARLIGHT READING",hp:1950,atk:980,chance:10000000,art:"assets/cards/art/awakened-promised-child.png",pos:"center",weatherOnly:"celestial",
      fx:{crit:{chance:25,mult:2}},
      desc:"(Eksklusif cuaca CELESTIAL) Peramal bintang dengan 25% peluang serangan kritis 2x damage."},
    {id:"CH_CELESTIAL_ORACLE",name:"CELESTIAL ORACLE",tier:"EX",type:"Seer",skill:"PROPHECY",hp:2280,atk:1140,chance:16000000,art:"assets/cards/art/rikas-blessing.png",pos:"center",weatherOnly:"celestial",
      fx:{revive:{pct:50}},
      desc:"(Eksklusif cuaca CELESTIAL) Peramal yang bangkit sekali dengan 50% HP setelah tumbang."},
    {id:"CH_UMBRAL_KNIFE",name:"UMBRAL KNIFE",tier:"UR",type:"Voidkeeper",skill:"SHADOW SIPHON",hp:2050,atk:1000,chance:14000000,art:"assets/cards/art/sickle-haze.webp",pos:"center",weatherOnly:"eclipse",
      fx:{lifesteal:20},
      desc:"(Eksklusif cuaca ECLIPSE) Pisau bayangan yang menyerap 20% damage yang diberikan sebagai HP."},
    {id:"CH_ECLIPSE_WARDEN",name:"ECLIPSE WARDEN",tier:"EX",type:"Voidkeeper",skill:"UMBRAL VEIL",hp:2560,atk:1020,chance:24000000,art:"assets/cards/art/king-of-curses.png",pos:"center",weatherOnly:"eclipse",
      fx:{dodgeAtk:{pct:30}},
      desc:"(Eksklusif cuaca ECLIPSE) Penjaga gerhana yang kadang meleset total lalu membalas."},
    {id:"CH_DOOMCRIER",name:"DOOMCRIER",tier:"UR",type:"Doombringer",skill:"ASHEN WARNING",hp:2300,atk:1150,chance:18000000,art:"assets/cards/art/armored-titan.jpg",pos:"center",weatherOnly:"apocalypse",
      fx:{burn:{chance:40,pct:10,turns:2}},
      desc:"(Eksklusif cuaca APOCALYPSE) Pembawa kabar kehancuran yang 40% peluang membakar musuh 10% max HP selama 2 giliran."},
    {id:"CH_APOCALYPSE_Herald",name:"APOCALYPSE HERALD",tier:"EX",type:"Doombringer",skill:"END TIMES",hp:2900,atk:1450,chance:36000000,art:"assets/cards/art/destruction-fist.webp",pos:"center",weatherOnly:"apocalypse",
      fx:{dmgMult:1.6},
      desc:"(Eksklusif cuaca APOCALYPSE) Herald akhir zaman dengan damage paling buas di seluruh katalog."}
  ]
};
/* ROLL SYSTEM - Pull-based RNG (bukan gacha pool) */
const RNG_ROLL_SPEED=1500; // ms per roll (base)
const RNG_ROLL_MIN=300;    // ms minimum per roll — speed cap, kartu harus sempat keliatan
const RNG_ROLL_MAX_MULT=RNG_ROLL_SPEED/RNG_ROLL_MIN; // ≈ 5×
const RNG_TOTAL_WEIGHT=1000000; // total weight untuk probability

/* ===== WEATHER SYSTEM (siklus ala ACC) =====
   Cuaca = state yang JALAN TERUS tanpa potion: siklus alami 30 menit per cuaca
   (roll weighted by dropWeight, TANPA pity - boleh turun kelas).
   Weather Potion (drop menara / Toko Inf) = SKIP: reroll cuaca sekarang ke cuaca acak lain,
   durasi 5 menit, PITY no-downgrade (gak pernah turun kelas dari weatherBest).
   weatherBest cuma ke-update dari roll POTION, biar pity gak kekunci roll alami.
   Mythic Weather Potion = sama (pity + 5 menit), tapi APOCALYPSE di-override jadi 3%.
   Pas aktif: totalLuck x luckBonus, roll speed x speedBonus, pool nambah kartu weatherOnly yang cocok. */
const WEATHER_MS=300000; // 5 menit (durasi window potion)
const WEATHER_ROTATE_MS=1800000; // 30 menit (siklus alami tiap cuaca)
const WEATHERS=[
  {id:"storm",      name:"BADAI",      icon:"⛈",  dropWeight:30, luckBonus:1.2, speedBonus:1.5, color:"#7dd3fc"},
  {id:"celestial",  name:"CELESTIAL",  icon:"✨",  dropWeight:20, luckBonus:2.0, speedBonus:2.0, color:"#fcd34d"},
  {id:"eclipse",    name:"ECLIPSE",    icon:"🌑",  dropWeight:5,  luckBonus:4.0, speedBonus:3.0, color:"#c4b5fd"},
  {id:"apocalypse", name:"APOCALYPSE", icon:"☄", dropWeight:1,  luckBonus:8.0, speedBonus:5.0, color:"#f87171"},
];
const WEATHER=Object.fromEntries(WEATHERS.map(w=>[w.id,w]));
/* Rank 0..N berdasar dropWeight ASC (paling langka = rank 0 = paling BAGUS). Pity pakai floorRank: hanya weather dengan rank <= floorRank yang bisa ke-roll. */
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
/* Roll 1 weather.
   opts.pity=true     -> hanya weather selevel/LEBIH BAGUS dari weatherBest (untuk potion).
   opts.boostApo=true -> APOCALYPSE di-override jadi 3% flat (untuk mythic). */
function rollWeather(opts){
  opts=opts||{};
  let eligible=WEATHERS;
  if(opts.pity&&state.weatherBest){const fr=weatherRank(state.weatherBest);eligible=WEATHERS.filter(w=>weatherRank(w.id)<=fr);}
  if(opts.boostApo&&eligible.some(w=>w.id==="apocalypse")){
    if(Math.random()<0.03)return WEATHER.apocalypse;
    const rest=eligible.filter(w=>w.id!=="apocalypse");
    if(rest.length)eligible=rest;
  }
  return weatherPick(eligible);
}
/* Skip cuaca: reroll SEKARANG (pity no-downgrade), durasi 5 menit. */
function useWeatherPotion(){
  if(!state||!state.potions||state.potions<1)return {ok:false,reason:"NO_POTION"};
  state.potions--;
  const w=rollWeather({pity:true});
  state.weatherBest=betterWeather(state.weatherBest,w.id);
  state.weather={id:w.id,endsAt:Date.now()+WEATHER_MS};
  save();
  return {ok:true,weather:w};
}
/* Mythic Weather Potion: sama (pity + 5 menit) tapi APOCALYPSE chance 3%. */
function useMythicWeatherPotion(){
  if(!state||(state.mythicPotions||0)<1)return {ok:false,reason:"NO_POTION"};
  state.mythicPotions--;
  const w=rollWeather({pity:true,boostApo:true});
  state.weatherBest=betterWeather(state.weatherBest,w.id);
  state.weather={id:w.id,endsAt:Date.now()+WEATHER_MS};
  save();
  return {ok:true,weather:w};
}
const WEATHER_POTION_PRICE=5000;
/* ====== POTION LUCK & SPEED (drop dari Infinite Tower). Buff sementara 5 menit, konsisten dgn Weather Potion.
   Pakai -> +1 luck flat / +1x speed selama window; pakai lagi saat masih aktif = nambah stack + refresh durasi. ====== */
const POTION_BUFF_MS=5*60*1000;
function activeLuckBuff(){if(!state||!state.luckBuff)return 0;if(Date.now()>=state.luckBuff.endsAt){state.luckBuff=null;return 0;}return state.luckBuff.flat||0;}
function activeSpeedBuff(){if(!state||!state.speedBuff)return 0;if(Date.now()>=state.speedBuff.endsAt){state.speedBuff=null;return 0;}return state.speedBuff.mult||0;}
function useLuckPotion(){if(!state||(state.luckPotions||0)<1)return{ok:false,reason:"NO_POTION"};state.luckPotions--;const now=Date.now();const cur=activeLuckBuff();const base=(state.luckBuff&&state.luckBuff.endsAt>now)?state.luckBuff.endsAt:now;state.luckBuff={flat:cur+1,endsAt:base+POTION_BUFF_MS};save();return{ok:true,flat:state.luckBuff.flat};}
function useSpeedPotion(){if(!state||(state.speedPotions||0)<1)return{ok:false,reason:"NO_POTION"};state.speedPotions--;const now=Date.now();const cur=activeSpeedBuff();const base=(state.speedBuff&&state.speedBuff.endsAt>now)?state.speedBuff.endsAt:now;state.speedBuff={mult:cur+1,endsAt:base+POTION_BUFF_MS};save();return{ok:true,mult:state.speedBuff.mult};}
/* Panel weather GABUNGAN (pojok kiri bawah): nama + "Ends in Xs" di atas, baris kartu
   weatherOnly (gaya index, hover reveal penuh) di tengah, buff luck/rollspeed di bawah.
   Nongol cuma pas weather aktif. Dipanggil tiap renderShell & tick detik. */
function renderWeatherDock(){
  const panel=document.getElementById("weatherPanel");if(!panel)return;
  const id=activeWeatherId();const w=id?WEATHER[id]:null;
  /* Panel cuma tampilkan kartu weatherOnly milik cuaca yang LAGI AKTIF (2 kartu: UR + EX). */
  const cards=MASTER_CARD_INDEX.filter(c=>c.weatherOnly===id);
  if(!w||!cards.length){panel.classList.remove("show");panel.innerHTML="";return;}
  panel.style.setProperty("--wc",w.color);
  panel.innerHTML=`<div class="wp-head"><span class="wp-name"><span class="wp-ic">${w.icon}</span>${w.name}</span><span class="wp-timer">Ends in ${fmtCountdown(state.weather.endsAt-Date.now())}</span></div>`
    +`<div class="wp-cards">`+cards.map(c=>
      `<div class="wc-slot active" data-wc="${c.char_id}" style="--wc:${w.color}">
        <span class="idx-art"><img src="${c.sprite_asset}" alt=""></span>
        <span class="idx-body"><span class="wc-chance">${rarityText(c.tier,luckChance(c.char_id))}</span></span>
      </div>`).join("")+`</div>`
    +`<div class="wp-buff">${w.luckBonus}x Luck · ${w.speedBonus}x Rollspeed</div>`;
  panel.classList.add("show");
  wcHoverBind();
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
     (weighted, tanpa pity), 30 menit. silent=true buat seeding pas boot (tanpa toast). */
  const ensureWeather=silent=>{
    if(!state)return null;
    if(state.weather&&Date.now()<state.weather.endsAt)return null;
    const w=rollWeather();
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
    renderWeatherDock();
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
// Weight = 1/ch^(1/L): pangkat mengecil saat luck naik -> distribusi MERATA ke arah kartu langka (luck MEMBANTU).
// Di L=1 tetap = 1/ch (awal main susah, sesuai desain). Luck ribuan -> langka makin attainable, tanpa overflow.
// Display "1 in X" memakai base MENTAH (ch, tanpa pembagian luck) lewat luckChance() — biar kesan rarity-nya "wah".
function rngRoll(luckMultiplier=1,speedMultiplier=1){
  const L=(typeof luckMultiplier==="number"&&luckMultiplier>0)?luckMultiplier:1;
  const aw=activeWeatherId();
  const pool=MASTER_CARD_INDEX.filter(c=>!c.noGacha&&(!c.weatherOnly||c.weatherOnly===aw));
  if(!pool.length)return null;
  const MUTS=["none","gold","rainbow","secret"];
  const entries=[];
  for(const c of pool){
    const base=c.chance||chanceOf(c.tier);
    for(const shiny of [false,true]){
      for(const mut of MUTS){
        const statMult=(shiny?SHINY_MULT:1)*(MUT_MULT[mut]||1);
        entries.push({card:c,mut,shiny,ch:base*statMult});
      }
    }
  }
  let total=0;
  const weights=entries.map(e=>{const w=1/Math.pow(e.ch,1/L);total+=w;return w;});
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
    if(!__batchRoll)save(); rollCountBadge();
    return s;
  }
  const ns = { id: Math.random().toString(36).slice(2, 9), char: charId, tier: card.tier, fav: false, lock: false, mut: m, shiny: sh, trait: "none", count: 1 };
  state.stacks.push(ns);
  if (!Array.isArray(state.deck)) state.deck = [null, null, null, null];
  state.deck.length = 4;
  const empty = state.deck.indexOf(null);
  if (empty >= 0) setDeckSlot(empty, ns.id); else if(!__batchRoll)save();
  rollCountBadge();
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
  /* ---- hero: avatar kartu utama (crop pos, pola sama renderFootProfile) + nama + XP ---- */
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
  /* ---- helper tile/seksi ---- */
  const tile=(lab,val,sub,tcls,vcls)=>`<div class="prof-tile${tcls?" "+tcls:""}"><span class="prof-tl">${lab}</span><span class="prof-tv${vcls?" "+vcls:""}">${val}</span>${sub?`<span class="prof-ts">${sub}</span>`:""}</div>`;
  const sec=(t,grid)=>`<section class="prof-sec"><h3 class="prof-sec-t">${t}</h3><div class="prof-grid">${grid}</div></section>`;
  /* ===== GACHA: luck lengkap, speed, battle speed, power, summon ===== */
  const base=p.luckBase??1, flat=p.luckFlat||0, treeF=treeLuckFlat(), artF=artLuckFlat(), artP=artLuckPct(), petF=petLuckFlat(), petP=petLuckPct(), plB=activeLuckBuff();
  const pct=(p.luckPercent||0)+treeLuckPct()+artP+petP;
  const wm=weatherLuckMult();
  const lparts=["Base "+base.toFixed(1)];
  if(flat>0)lparts.push("Player +"+flat.toFixed(1));
  if(treeF>0)lparts.push("Pohon +"+treeF.toFixed(1));
  if(artF>0||artP>0)lparts.push("Artefak +"+artF.toFixed(1)+(artP>0?" / +"+Math.round(artP*100)+"%":""));
  if(petF>0||petP>0)lparts.push("Pet +"+petF.toFixed(1)+(petP>0?" / +"+Math.round(petP*100)+"%":""));
  if(plB>0)lparts.push("Buff +"+plB.toFixed(1));
  if(pct>0)lparts.push("Pct +"+Math.round(pct*100)+"%");
  if(wm>1)lparts.push("Cuaca ×"+wm.toFixed(1));
  const spm=playerSpeedMult(), swm=weatherSpeedMult();
  const eff=Math.min(spm*swm,RNG_ROLL_MAX_MULT);
  const sparts=[];if(spm>1)sparts.push("Pohon/Buff ×"+spm.toFixed(1));if(swm>1)sparts.push("Cuaca ×"+swm.toFixed(1));
  const bsMax=battleSpeedMax();
  const bsNext=bsMax<4?("Berikutnya: "+(bsMax===1?"LV25 → 2×":bsMax===2?"LV50 → 3×":"LV100 → 4×")):"Semua kecepatan terbuka";
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
    tile("INFINITE TOWER",`Lantai ${(state.tower&&state.tower.best)||0}`,((state.tower&&state.tower.auto)?"<b class=\"prof-ok\">AUTO RESTART: AKTIF</b>":"AUTO RESTART: MATI"))
    +tile("SKILL POINT",`${p.sp||0}`,"untuk talent tree")
    +tile("HADIAH HARIAN",`HARI ${di+1} / 7`,`berikutnya +${fmt(DAILY_REWARDS[di]||0)} coin`)
    +storyTiles
    +tile("BOSS RAID",`${raidDone} / ${RAID_DIFFS.length}`,raidSub,"wide");
  /* ===== EKUIPMEN: artefak + pet dengan kontribusi luck ===== */
  const artTile=i=>{const id=state.artSlots&&state.artSlots[i];
    const d=id?ART_DEFS.find(x=>x.id===id):null;
    if(!d)return tile("ARTEFAK "+(i+1),"KOSONG","slot belum terpasang");
    const b=[];if(d.flat)b.push("+"+d.flat+" flat");if(d.pct)b.push("+"+Math.round(d.pct*100)+"%");
    return tile("ARTEFAK "+(i+1),d.name,b.length?b.join(" · "):"tanpa bonus luck");};
  const pd=state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;
  const petB=[];if(pd){if(pd.flat)petB.push("+"+pd.flat+" flat");if(pd.pct)petB.push("+"+Math.round(pd.pct*100)+"%");}
  const equip=
    artTile(0)+artTile(1)
    +tile("PET",pd?pd.name:"TIDAK ADA",pd?(petB.length?petB.join(" · "):"tanpa bonus luck"):"belum ada pet dipakai")
    +tile("ARTEFAK DIMILIKI",`${(state.artOwned||[]).length} / ${ART_DEFS.length}`,"total koleksi artefak")
    +tile("PET DIMILIKI",`${(state.petOwned||[]).length} / ${PET_DEFS.length}`,"total koleksi pet");
  /* ===== ITEM & BUFF: token, potion, cuaca & buff aktif (countdown live) ===== */
  const wAct=(state.weather&&Date.now()<state.weather.endsAt)?WEATHER[state.weather.id]:null;
  const wSub=wAct?`sisa ${fmtCountdown(state.weather.endsAt-Date.now())} · Luck ×${wAct.luckBonus} · Speed ×${wAct.speedBonus}`:"siklus alami 30 menit";
  const lb=plB, sb=activeSpeedBuff();
  const bparts=[];
  if(lb>0&&state.luckBuff&&state.luckBuff.endsAt>Date.now())bparts.push(`Luck +${lb} · sisa ${fmtCountdown(state.luckBuff.endsAt-Date.now())}`);
  if(sb>0&&state.speedBuff&&state.speedBuff.endsAt>Date.now())bparts.push(`Speed +${sb} · sisa ${fmtCountdown(state.speedBuff.endsAt-Date.now())}`);
  const item=
    tile("COIN",fmt(state.coins||0),"")
    +tile("TOKEN RAID",fmt(state.raidTokens||0),"dari Boss Raid")
    +tile("TOKEN INF",fmt(state.infTokens||0),"mata Infinite Tower")
    +tile("WEATHER POTION",`×${state.potions||0}`,"skip cuaca 5 menit")
    +tile("MYTHIC POTION",`×${state.mythicPotions||0}`,"reroll pity + APOCALYPSE 3%")
    +tile("LUCK POTION",`×${state.luckPotions||0}`,"buff luck sementara")
    +tile("SPEED POTION",`×${state.speedPotions||0}`,"buff speed sementara")
    +tile("CUACA AKTIF",wAct?`${wAct.icon} ${wAct.name}`:"TIDAK AKTIF",wSub,"wide")
    +tile("BUFF AKTIF",(lb>0||sb>0)?"AKTIF":"TIDAK AKTIF",bparts.length?bparts.join(" · "):"pakai potion untuk buff sementara","wide");
  body.innerHTML=
    sec("GACHA",gacha)
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
  if(bpTab==='tree'){panel.innerHTML=header+`<div class="bp-body tree">${renderBpTree()}</div>`;return;}
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
  const visible=state.stacks.filter(bpMatchesMut);
  const tiles=visible.map(s=>{
    const inDeck=state.deck.includes(s.id);
    const shny=s.shiny?'<span class="bpt-shiny">SHINY</span>':'';
    const mut=(s.mut&&s.mut!=='none')?s.mut:null;
    const trait=(s.trait&&s.trait!=='none')?s.trait:null;
    const cnt=(s.count||1)>1?`<span class="bpt-cnt">&times;${fmt(s.count)}</span>`:'';
    const stack=(shny||mut||trait)?`<div class="bpt-top">${shny}${mut?mutChip(mut,`<span class="bpt-mut" style="border-color:${MUT_COLOR[mut]}">${mutBadge(mut)}</span>`):''}${trait?traitChip(trait,`<span class="bpt-gem" style="border-color:${TRAIT_COLOR[trait]}">${traitGem(12,trait)}</span>`):''}</div>`:'';
    return `<div class="bp-tile${inDeck?' in-deck':''}" data-sid="${s.id}" onclick="bpAssign('${s.id}')" style="--tcol:${TIER_COLOR[s.tier]}"><img src="${cardImg(s.char)}" alt="">${stack}${cnt}<div class="bpt-ctl"><button class="bpt-fav${s.fav?' on':''}" onclick="event.stopPropagation();bpFav('${s.id}')" title="Favorit">${s.fav?'★':'☆'}</button><button class="bpt-lock${s.lock?' on':''}" onclick="event.stopPropagation();bpLock('${s.id}')" title="Lock">${s.lock?'🔒':'🔓'}</button></div><div class="bpt-name">${cardName(s.char)}</div></div>`;
  }).join('');
  const cntOf=m=>state.stacks.filter(s=>m==='all'?true:(m==='shiny'?!!s.shiny:(s.mut||'none')===m)).length;
  const chip=(k,lbl)=>{const on=bpMutFilter===k;const col=!on?(MUT_COLOR[k]||'#7DF9FF'):'';return `<button class="bp-fchip${on?' on':''}" onclick="bpSetFilter('${k}')"${col?` style="border-color:${col};color:${col}"`:''}>${lbl}<em>${cntOf(k)}</em></button>`;};
  const filterRow=`<div class="bp-filter">${chip('all','SEMUA')+chip('shiny','SHINY')+chip('gold','GOLD')+chip('rainbow','RAINBOW')+chip('secret','SECRET')}</div>`;
  panel.innerHTML=header+`<div class="bp-body"><div class="bp-cols">
    <div class="bp-h">DECK AKTIF</div>
    <div class="bp-deckcol">
      <div class="bp-slots">${slots}</div><div class="bp-deckmeta"><span class="bdm-l">TOTAL POWER</span><b class="bdm-v">${fmt(deckTotalPower())}</b><button class="bp-save" onclick="beep(660,.08);toast('DECK TERSIMPAN','SIAP DIPAKAI','#7DF9FF')">SIMPAN DECK</button></div>
    </div>
    <div class="bp-collect">
      ${filterRow}
      <div class="bp-h">KOLEKSI</div>
      ${visible.length?`<div class="bp-tiles">${tiles}</div>`:`<div class="bp-empty" style="padding:18px 0">Tidak ada kartu varian ini.</div>`}
    </div>
  </div></div>`;
}
/* Tab ITEM di backpack: tile icon ringkas; klik -> popup konfirmasi PAKAI. Item: Weather / Luck / Speed Potion. */
function bpItemDef(kind){
  if(kind==='potion'){const aw=activeWeatherId();return{kind,name:'WEATHER POTION',icon:'assets/images/icon-potion.png',emoji:'🧪',cnt:state.potions||0,
    desc:'SKIP cuaca sekarang: roll cuaca acak lain, bertahan 5 menit. Nggak pernah lebih jelek dari cuaca terbaikmu'+(state.weatherBest?' ('+WEATHER[state.weatherBest].name+')':'')+'. Cuaca juga jalan otomatis tiap 30 menit tanpa potion.',
    active:aw?`<br><strong style="color:${WEATHER[aw].color}">Aktif: ${WEATHER[aw].icon} ${WEATHER[aw].name}</strong>`:'',use:'bpUsePotion()'};}
  if(kind==='luck'){const b=activeLuckBuff();return{kind,name:'LUCK POTION',icon:'assets/images/icon-luck.png',emoji:'🍀',cnt:state.luckPotions||0,
    desc:'+1 Luck selama 5 menit. Pakai lagi saat masih aktif = nambah stack + refresh durasi.',
    active:b?`<br><strong style="color:#5eead4">Aktif: +${b} LUCK</strong>`:'',use:'bpUseLuckPotion()'};}
  if(kind==='speed'){const b=activeSpeedBuff();return{kind,name:'SPEED POTION',icon:'assets/images/icon-speed.png',emoji:'⚡',cnt:state.speedPotions||0,
    desc:'+1× Roll Speed selama 5 menit (kena cap 5×). Pakai lagi saat masih aktif = nambah stack + refresh durasi.',
    active:b?`<br><strong style="color:#fcd34d">Aktif: +${b}× SPEED</strong>`:'',use:'bpUseSpeedPotion()'};}
  if(kind==='mythic'){const aw=activeWeatherId();return{kind,name:'MYTHIC WEATHER POTION',icon:'assets/images/icon-mythic.png',emoji:'✨',cnt:state.mythicPotions||0,
    desc:'SKIP cuaca sekarang (5 menit, pity sama) - APOCALYPSE chance 3% (potion biasa ~1,8%).',
    active:aw?`<br><strong style="color:${WEATHER[aw].color}">Aktif: ${WEATHER[aw].icon} ${WEATHER[aw].name}</strong>`:'',use:'bpUseMythicPotion()'};}
  return null;
}
function renderBpItems(){
  const kinds=['potion','mythic','luck','speed'];
  const tiles=kinds.map(k=>{const d=bpItemDef(k);return `<div class="bp-itemtile${d.cnt>0?'':' empty'}" onclick="bpItemPop('${k}')"><div class="bp-itemtile-ic"><img src="${d.icon}" alt="${d.name}" onerror="this.parentNode.textContent='${d.emoji}'"></div><span class="bp-itemtile-cnt">×${fmt(d.cnt)}</span></div>`;}).join('');
  return `<div class="bp-h">ITEM</div><div class="bp-itemgrid">${tiles}</div>`;
}
function bpItemPop(kind){
  bpItemPopClose();
  const d=bpItemDef(kind); if(!d)return;
  const canUse=d.cnt>0;
  const el=document.createElement('div'); el.id='itemPop';
  el.innerHTML=`<div class="item-pop-back" onclick="bpItemPopClose()"></div>
    <div class="item-pop">
      <div class="item-pop-ic"><img src="${d.icon}" alt="${d.name}" onerror="this.parentNode.textContent='${d.emoji}'"></div>
      <div class="item-pop-name">${d.name}</div>
      <div class="item-pop-cnt">Punya: ×${fmt(d.cnt)}</div>
      <div class="item-pop-desc">${d.desc}${d.active||''}</div>
      <div class="item-pop-ctl">
        <button class="bpi-use" ${canUse?'':'disabled'} onclick="${d.use}">PAKAI</button>
        <button class="item-pop-cancel" onclick="bpItemPopClose()">BATAL</button>
      </div>
    </div>`;
  document.body.appendChild(el);
}
function bpItemPopClose(){const e=document.getElementById('itemPop');if(e)e.remove();}
function bpUsePotion(){
  const r=useWeatherPotion();
  if(!r.ok){toast("Potion habis","GAK ADA POTION","#f87171");return;}
  beep(520,.16,"triangle",.1);setTimeout(()=>beep(780,.18,"triangle",.1),120);
  toast(`${r.weather.icon} ${r.weather.name}`,"WEATHER AKTIF · 5 MENIT",r.weather.color);
  bpItemPopClose();renderShell();renderBackpackPanel();
}
function bpUseLuckPotion(){
  const r=useLuckPotion();
  if(!r.ok){toast("Potion habis","GAK ADA POTION","#f87171");return;}
  beep(560,.14,"triangle",.09);setTimeout(()=>beep(820,.14,"triangle",.08),110);
  toast("LUCK POTION","+"+r.flat+" LUCK · 5 MENIT","#5eead4");
  bpItemPopClose();renderShell();renderBackpackPanel();
}
function bpUseSpeedPotion(){
  const r=useSpeedPotion();
  if(!r.ok){toast("Potion habis","GAK ADA POTION","#f87171");return;}
  beep(720,.14,"square",.08);setTimeout(()=>beep(980,.14,"square",.07),110);
  toast("SPEED POTION","+"+r.mult+"× SPEED · 5 MENIT","#fcd34d");
  bpItemPopClose();renderShell();renderBackpackPanel();
}
function bpUseMythicPotion(){
  const r=useMythicWeatherPotion();
  if(!r.ok){toast("Potion habis","GAK ADA POTION","#f87171");return;}
  beep(520,.16,"triangle",.1);setTimeout(()=>beep(880,.2,"triangle",.1),120);
  toast(`${r.weather.icon} ${r.weather.name}`,"WEATHER AKTIF · APOCALYPSE 3%",r.weather.color);
  bpItemPopClose();renderShell();renderBackpackPanel();
}
/* ====== TAB TREE: pohon skill. Root di tengah, dua cabang menjalar (LUCK kiri | SPEED kanan).
   SP didapet tiap naik LV; node butuh node sebelumnya di cabang yang sama. ====== */
function stNodeHtml(n,sp){
  const owned=treeOwned(n.id);
  const preqMet=n.req.every(r=>r==="root"||treeOwned(r));
  const affordable=sp>=n.cost;
  const state=owned?'owned':(preqMet&&affordable?'avail':(preqMet?'poor':'locked'));
  const gain=n.branch==='luck'?('+'+(Number.isInteger(n.luck)?n.luck:n.luck.toFixed(1))+' LUCK'+(n.luckPct?' · +'+Math.round(n.luckPct*100)+'%':'')):('+'+n.speed.toFixed(1)+'× SPEED');
  const ic=BP_NODE_ICONS[n.name]||'◆';
  return `<div class="st-node st-${n.branch} st-${state}" onclick="bpTreeBuy('${n.id}')" title="${n.desc}">
    <div class="st-ico">${ic}</div>
    <div class="st-info"><div class="st-name">${n.name}</div><div class="st-gain">${n.branch==='root'?'AKAR':gain}</div></div>
    ${n.branch==='root'?'':`<div class="st-cost">${owned?'✓':n.cost+' SP'}</div>`}
  </div>`;
}
const BP_NODE_ICONS={"FONDASI":"◆","PEKA":"◉","TERLIHAT":"◎","MENTARI":"☀","BERTUAH":"☆","MUARA REZEKI":"☘","RINGAN":"⇢","CEPAT":"➤","PETIR":"⚡","KILAT":"≫","CAHAYA":"✦"};
function stLinkHtml(src){
  const owned=treeOwned(src.id);
  const preqMet=src.req.every(r=>r==="root"||treeOwned(r));
  const affordable=(state&&state.player&&state.player.sp||0)>=src.cost;
  const cls=owned?'flow':(preqMet&&affordable?'pulse':'dead');
  return `<div class="st-link ${cls}"><i></i></div>`;
}
function renderBpTree(){
  const sp=(state&&state.player&&state.player.sp)||0;
  const luck=TREE_NODES.filter(n=>n.branch==='luck');
  const spd=TREE_NODES.filter(n=>n.branch==='speed');
  const col=(branch,title,ic,list,cap)=>`<div class="st-col ${branch}">
      <div class="st-col-h"><span class="st-col-ic">${ic}</span>${title}</div>
      <div class="st-chain">${list.map((n,i)=>(i?stLinkHtml(list[i-1]):'')+stNodeHtml(n,sp)).join('')}</div>
      <div class="st-col-cap">${cap}</div>
    </div>`;
  const goal=TREE_NODES.filter(n=>n.id!=='root'&&!treeOwned(n.id)&&n.req.every(r=>r==='root'||treeOwned(r))).sort((a,b)=>a.cost-b.cost)[0];
  const pct=goal?Math.min(100,Math.round(sp/goal.cost*100)):100;
  const ready=!!goal&&sp>=goal.cost;
  const hint=sp>0?'ketuk node buat naikkin':'naikkin LV buat dapet SP';
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
    <div class="st-root">${stNodeHtml(TREE.root,sp)}</div>
    <svg class="st-fork" viewBox="0 0 600 74" preserveAspectRatio="none">
      <defs>
        <linearGradient id="fkL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7DF9FF"/><stop offset="1" stop-color="#5eead4"/></linearGradient>
        <linearGradient id="fkR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7DF9FF"/><stop offset="1" stop-color="#fcd34d"/></linearGradient>
      </defs>
      <path class="fk-base" d="M300 4 C300 40 146 34 146 74" stroke="url(#fkL)" vector-effect="non-scaling-stroke"/>
      <path class="fk-flow" d="M300 4 C300 40 146 34 146 74" stroke="url(#fkL)" vector-effect="non-scaling-stroke"/>
      <path class="fk-base" d="M300 4 C300 40 454 34 454 74" stroke="url(#fkR)" vector-effect="non-scaling-stroke"/>
      <path class="fk-flow" d="M300 4 C300 40 454 34 454 74" stroke="url(#fkR)" vector-effect="non-scaling-stroke"/>
      <rect class="fk-jewel" x="293" y="-3" width="14" height="14" rx="3" transform="rotate(45 300 4)"/>
    </svg>
    <div class="st-cols">
      ${col('luck','CABANG LUCK','☘',luck,'Total luck sekarang: '+totalLuck().toFixed(1)+'×')}
      ${col('speed','CABANG ROLL SPEED','⚡',spd,'Speed sekarang: '+playerSpeedMult().toFixed(1)+'× (cap 5×)')}
    </div>`;
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
function renderBpArts(){
  const coins=state.coins||0;
  const slots=[0,1].map(i=>{
    const id=state.artSlots[i],d=id?ART_DEFS.find(x=>x.id===id):null;
    if(!d)return `<div class="bp-aslot empty" onclick="toast('SLOT KOSONG','BELI ARTEFAK DULU','#fcd34d')"><span>◈</span></div>`;
    return `<div class="bp-aslot filled" style="--ec:${d.color}" onclick="bpArtSlot(${i})">${artIconSvg(d.icon)}<span class="bp-aslot-n">${d.name}</span><button class="bp-aslot-x" onclick="event.stopPropagation();bpArtSlot(${i})">&times;</button></div>`;
  }).join('');
  const cards=ART_DEFS.map(d=>{
    const owned=state.artOwned.includes(d.id),eq=state.artSlots.includes(d.id);
    const btn=eq?`<button class="bp-shop-b off" onclick="bpToggleArt('${d.id}')">LEPAS</button>`
      :owned?`<button class="bp-shop-b on" onclick="bpToggleArt('${d.id}')">PASANG</button>`
      :`<button class="bp-shop-b ${coins>=d.price?'buy':'poor'}" onclick="bpBuyArt('${d.id}')">BELI · 🪙 ${fmt(d.price)}</button>`;
    return `<div class="bp-shop${eq?' eq':''}" style="--ec:${d.color}"><div class="bp-shop-ic">${artIconSvg(d.icon)}</div><div class="bp-shop-n">${d.name}</div><div class="bp-shop-e">${luckTxt(d)}</div>${btn}</div>`;
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
      :`<button class="bp-shop-b ${coins>=p.price?'buy':'poor'}" onclick="bpBuyPet('${p.id}')">BELI · 🪙 ${fmt(p.price)}</button>`;
    return `<div class="bp-shop${eq?' eq':''}" style="--ec:#7DF9FF"><div class="bp-shop-ic"><img src="${p.img}" alt="${p.name}" onerror="this.parentNode.classList.add('noimg')"><span class="ph">${p.emoji}</span></div><div class="bp-shop-n">${p.name}</div><div class="bp-shop-e">${luckTxt(p)}</div>${btn}</div>`;
  }).join('');
  return `<div class="bp-h">PET · 1 SLOT<div class="bp-coinrow">☘ ${totalLuck().toFixed(1)}× · 🪙 ${fmt(coins)}</div></div>
  ${actHtml}
  <div class="bp-grid6">${cards}</div>`;
}

function bpBuyArt(id){
  const d=ART_DEFS.find(x=>x.id===id);if(!d||state.artOwned.includes(id))return;
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
  return `<div class="lobby-pet" title="${d.name}"><img src="${d.img}" alt="${d.name}" onerror="this.parentNode.classList.add('noimg')"><span class="lp-eb">${d.emoji}</span></div>`;
}

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
const MASTER_CARD_INDEX=STORY_BIBLE.units.map(u=>({char_id:u.id,name:u.name,tier:u.tier,chance:u.chance||null,type:u.type,base_hp:u.hp,base_atk:u.atk,sprite_asset:u.art,art_image:u.art,pos:u.pos||null,passive:{name:u.skill,desc:u.desc},noGacha:!!u.noGacha,weatherOnly:u.weatherOnly||null}));
const CARDS=Object.fromEntries(MASTER_CARD_INDEX.map(c=>[c.char_id,c]));
function getCardData(id){return CARDS[id]||null;}
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
const FX_KNOWN=["double","crit","pierce","barrage","evasion","lifesteal","void","highHpDmg","lowHpAtk",
  "revive","dmgMult","ignoreDef","purple","domain","ranton","dodgeAtk","everySecond","lastStand",
  "styleSwitching","burst","hpDrain","lifetime","entryCounter","dodgeEvery","everyNth","lowHpAura",
  "executeOnEntry","transform","wallTitans","rumbling","bungeeGum","snatch","arise","prideOfPrince",
  "regression","copy","entryShatter","entryMaxHp","turnMaxHp","splitDeath","deathDefy","openingHit","burn","desperateStrike"];
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
  const base=fxOf(stack);
  if(!base.copy)return base;
  const o=Object.assign({},enemyFx||{});
  delete o.copy;
  return mergeFx(o,TRAIT_FX[stack.trait]||{});
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
  const newState={coins:1000,raidTokens:0,playerLv:1,xp:0,dailyIndex:0,lastClaim:"",summons:0,muted:false,diff:"normal",chap:1,raidDiff:"normal",raidCleared:{normal:false,hard:false,extreme:false,nightmare:false},tower:{best:0,auto:false},battleSpeed:1,
    cleared:{},clearedDiff:{normal:{},hard:{},extreme:{},nightmare:{}},equippedId:start?start.id:null,equippedId2:null,deck:[start?start.id:null,null,null,null],stacks:start?[start]:[],history:[],battle:null,
    player:{luckBase:1,luckFlat:0,luckPercent:0,exp:0,lv:1,sp:0,tree:{}},weather:null,weatherBest:null,potions:0,mythicPotions:0,luckPotions:0,speedPotions:0,luckBuff:null,speedBuff:null,infTokens:0,
    artOwned:[],artSlots:[null,null],petOwned:[],petEquipped:null};
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
  if(typeof state.luckPotions!=="number"||state.luckPotions<0)state.luckPotions=0;
  if(typeof state.speedPotions!=="number"||state.speedPotions<0)state.speedPotions=0;
  if(typeof state.infTokens!=="number"||state.infTokens<0)state.infTokens=0;
  /* ARTEFAK + PET: field baru — player lama mulai kosong, id korup dibuang. */
  if(!Array.isArray(state.artOwned))state.artOwned=[];
  state.artOwned=state.artOwned.filter(id=>ART_DEFS.some(a=>a.id===id));
  if(!Array.isArray(state.artSlots)||state.artSlots.length!==2)state.artSlots=[null,null];
  state.artSlots=state.artSlots.map(id=>(id&&state.artOwned.includes(id))?id:null);
  if(!Array.isArray(state.petOwned))state.petOwned=[];
  state.petOwned=state.petOwned.filter(id=>PET_DEFS.some(p=>p.id===id));
  if(!state.petEquipped||!state.petOwned.includes(state.petEquipped))state.petEquipped=null;
  if(state.luckBuff&&typeof state.luckBuff.endsAt!=="number")state.luckBuff=null;
  if(state.speedBuff&&typeof state.speedBuff.endsAt!=="number")state.speedBuff=null;
  if(state.luckBuff&&Date.now()>=state.luckBuff.endsAt)state.luckBuff=null;
  if(state.speedBuff&&Date.now()>=state.speedBuff.endsAt)state.speedBuff=null;
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
  try{renderWeatherDock();startWeatherTick();}catch(e){}
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
  bt={speed:battleSpeedEff(),lv,en,es,eq,fighters,eid,efx,active:0,revUsed:new Array(fighters.length).fill(false),justTagged:false,pHp:base.hp,pMax:base.hp,eHp:es.hp,turn:1,over:false,eBurn:0,phase2used:false,domainUsed:false,domainLeft:0,eStun:0,pStun:0,pDr:0,pDrTurns:0,atkBuff:new Array(fighters.length).fill(0),dodgeStack:new Array(fighters.length).fill(0),atkCount:new Array(fighters.length).fill(0),standUsed:new Array(fighters.length).fill(false),styleCount:new Array(fighters.length).fill(0),burstStart:new Array(fighters.length).fill(1),entryGuard:new Array(fighters.length).fill(false),dodgeArmed:new Array(fighters.length).fill(false),dodgeCount:new Array(fighters.length).fill(0),execGuard:new Array(fighters.length).fill(false),shatterGuard:new Array(fighters.length).fill(false),wtCount:new Array(fighters.length).fill(0),snatchAtk:new Array(fighters.length).fill(0),snatchHp:new Array(fighters.length).fill(0),regressCharges:new Array(fighters.length).fill(0),bioGuard:new Array(fighters.length).fill(false),splitLeft:new Array(fighters.length).fill(0),splitMult:new Array(fighters.length).fill(1),rumbling:0,rumblingPct:0,defyUsed:new Array(fighters.length).fill(false),defyHold:false,openGuard:true,dsState:new Array(fighters.length).fill(0),aftermath:false,gumTurns:0,trickNext:false,royalNow:false,gunsNow:false,shadow:null};
  // BURST: kartu pertama masuk arena langsung dapat boost HP kalau punya fx.burst
  const fx0=resolveFx(eq,efx);
  if(fx0.burst){bt.pMax=Math.round(base.hp*fx0.burst.mult);bt.pHp=bt.pMax;}
  if(fx0.transform){bt.pMax=Math.round(base.hp*fx0.transform.mult);bt.pHp=bt.pMax;}
  if(fx0.entryCounter)bt.entryGuard[0]=true;
  if(fx0.executeOnEntry)bt.execGuard[0]=true;
  if(fx0.entryShatter)bt.shatterGuard[0]=true;
  if(fx0.entryMaxHp)bt.bioGuard[0]=true;
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
    bt.revUsed[a]=false;bt.standUsed[a]=false;bt.burstStart[a]=bt.turn;
    bt.dodgeCount[a]=0;bt.dodgeArmed[a]=false;bt.atkCount[a]=0;bt.wtCount[a]=0;
    if(fx.entryCounter)bt.entryGuard[a]=true;
    if(fx.executeOnEntry)bt.execGuard[a]=true;
    if(fx.entryShatter)bt.shatterGuard[a]=true;
    if(fx.entryMaxHp)bt.bioGuard[a]=true;
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
    bt.revUsed[a]=false;bt.standUsed[a]=false;bt.burstStart[a]=bt.turn;
    bt.dodgeCount[a]=0;bt.dodgeArmed[a]=false;bt.atkCount[a]=0;bt.wtCount[a]=0;
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","SPLIT!","heal");},bsMs(400));
    return true;
  }
  if(fx.revive&&!bt.revUsed[a]){
    bt.revUsed[a]=true;bt.pHp=bt.pMax;
    setTimeout(()=>floatText(".fighter.me","REVIVE!","heal"),bsMs(400));
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
  if(a+1<bt.fighters.length){tagIn();return true;}
  /* LAST CARD MATI tapi Rumbling masih jalan → jangan langsung kalah; masuk mode aftermath (DoT tick doang) */
  if(bt.rumbling>0){bt.aftermath=true;return true;}
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
    if(o.barrageN>1)setTimeout(()=>floatText(D,(o.domainStrike?"UNLIMITED VOID ×":o.ariseMode?"ARISE ×":md?"TENSA ×":"CLEAVE ×")+o.barrageN,"crit"),bsMs(md?MADARA_T.slash:320));
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
  if(bt.turn>300){ endBattle(bt.eHp<=bt.pHp); return; }
  /* AFTERMATH: kartu terakhir udah mati, Rumbling doang yang jalan — bisa nyulik menang, abis itu kalah */
  if(bt.aftermath){
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
  document.getElementById("turnLabel").innerHTML=(bt.tower&&towerRun)?("LANTAI <b>"+towerRun.floor+"</b> · GELOMBANG <b>"+(towerRun.idx+1)+"/"+towerRun.waves.length+"</b>"):("TURN<br>"+t);
  setTurnPill("you","GILIRANMU");
  /* RUMBLING: DoT sisa dari kartu yang udah mati — jalan tiap giliran walau kartu udah ganti */
  if(bt.rumbling>0){
    const rd=Math.round(bt.es.hp*(bt.rumblingPct||10)/100);
    bt.eHp-=rd;bt.rumbling--;
    setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","RUMBLING -"+fmt(rd),"burn");}},bsMs(200));
    if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
  }
  /* TURN MAX HP (BIOKINESIS): tiap giliran kartu ini aktif & hidup, kartu aktif musuh rugi pct% MAX HP (flat).
     Ditaruh SEBELUM cek stun biar aura tetap nyala walau kartu kena stun. Boss NPC kebal. */
  if(fx.turnMaxHp&&!bt.en.boss&&bt.eHp>0){
    const td=Math.max(1,Math.round(bt.es.hp*fx.turnMaxHp.pct/100));
    bt.eHp-=td;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","BIOKINESIS -"+fmt(td),"burn");}},bsMs(200));
    if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
  }
  if(bt.pStun>0){
    bt.pStun--;
    const lbl=(bt.pDrTurns>0&&bt.pDr)?"STUN · DR "+bt.pDr+"%":"STUN";
    setTimeout(()=>floatText(".fighter.me",lbl,"crit"),bsMs(200));
    schedPhase(600,enemyPhase);
    return;
  }
  const efx=bt.efx||{};
  const a=bt.active;
  /* DESPERATE STRIKE: di bawah below% HP -> serangan berikutnya ×mult, sesudahnya tewas di akhir giliran */
  if(fx.desperateStrike&&bt.dsState[a]===0&&bt.pHp>0&&bt.pHp<bt.pMax*fx.desperateStrike.below/100)bt.dsState[a]=1;
  /* DODGE EVERY: setiap N giliran sejak masuk, pasti hindari serangan musuh giliran ini */
  if(fx.dodgeEvery){bt.dodgeCount[a]=(bt.dodgeCount[a]||0)+1;if(bt.dodgeCount[a]%fx.dodgeEvery.turns===0)bt.dodgeArmed[a]=true;}
  /* EXECUTE ON ENTRY (SUPERNOVA): saat masuk, kalau HP musuh < pct% HP kartu ini, hancurkan instan */
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
  /* ENTRY MAX HP (BIOKINESIS): saat masuk, kartu aktif musuh rugi pct% MAX HP sebagai damage flat (bypass evasion/void).
     Boss NPC kebal. Guard sekali-per-masuk persis pola entryShatter. */
  if(fx.entryMaxHp&&bt.bioGuard[a]){
    bt.bioGuard[a]=false;
    if(bt.eHp>0&&!bt.en.boss){
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
  if(fx.openingHit&&bt.openGuard&&bt.eHp>0){dmgMult*=(1+fx.openingHit.pct/100);bt.openGuard=false;}
  /* DESPERATE STRIKE dilepas: ×mult sekali lalu state=2 -> mati di awal enemyPhase (lihat blok dsState) */
  if(fx.desperateStrike&&bt.dsState[a]===1){dmgMult*=fx.desperateStrike.mult;bt.dsState[a]=2;setTimeout(()=>floatText(".fighter.me",fx.desperateStrike.text||"DESPERATE STRIKE","crit"),bsMs(200));}
  /* SATU PERSEN (Ultra Instinct): tiap serangan GENAP (ke-2, ke-4, ...) = 1% kekuatan penuh → ×mult damage + tembus damage reduction musuh */
  let pen=!!fx.ignoreDef;
  if(fx.everySecond){bt.atkCount[a]++;if(bt.atkCount[a]%2===0){dmgMult*=fx.everySecond.mult;pen=true;setTimeout(()=>floatText(".fighter.me","ONE PERCENT","crit"),bsMs(220));}}
  /* SUSANOO CHIDORI: tiap serangan ke-N → ×mult damage + menembus pengurangan damage */
  if(fx.everyNth){bt.atkCount[a]++;if(bt.atkCount[a]%fx.everyNth.n===0){dmgMult*=fx.everyNth.mult;pen=true;setTimeout(()=>floatText(".fighter.me",fx.everyNth.text||"SUSANOO CHIDORI","crit"),bsMs(220));}}
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
  /* BUNGEE GUM: selama gum masih nempel di musuh (ditempel waktu musuh nyerang), serangan ×(1+bonus%) lalu hitung mundur */
  if(fx.bungeeGum&&bt.gumTurns>0){dmgMult*=(1+fx.bungeeGum.bonus/100);bt.gumTurns--;}
  const hits=[{mult:1}];
  if(fx.double&&Math.random()*100<fx.double)hits.push({mult:1});
  let crit=false;
  if(fx.crit&&Math.random()*100<fx.crit.chance){crit=true;hits[hits.length-1].mult*=fx.crit.mult;}
  else if(Math.random()*100<BASE_CRIT.chance){crit=true;hits[hits.length-1].mult*=BASE_CRIT.mult;}
  let purple=false;
  if(fx.purple&&Math.random()*100<fx.purple.chance){purple=true;crit=true;hits[hits.length-1].mult*=fx.purple.mult;}
  let ranton=false;
  if(fx.ranton&&Math.random()*100<fx.ranton.chance){ranton=true;crit=true;hits.length=0;const rh=Math.max(1,fx.ranton.hits||5),rm=fx.ranton.mult||1;for(let k=0;k<rh;k++)hits.push({mult:rm});}
  let barrageN=0;
  if(fx.barrage&&Math.random()*100<fx.barrage.chance){const n=fx.barrage.min+Math.floor(Math.random()*(fx.barrage.max-fx.barrage.min+1));const bm=fx.barrage.mult||1;if(bm!==1){hits.length=0;for(let i=0;i<n;i++)hits.push({mult:bm});}else{while(hits.length<n)hits.push({mult:1});}barrageN=hits.length;}
  if(ranton&&!barrageN)barrageN=hits.length;
  // DOMAIN EXPANSION (Gojo, disamakan dengan Shrine Sukuna): 100% tiap ronde → 15 sambaran @30% ATK + lifesteal + recharge (stun 1 & DR 50% 2 ronde)
  let domainStrike=false;
  if(fx.domain&&id==="CH_EX_GOJO"&&Math.random()*100<(fx.domain.chance||100)){const dn=fx.domain.min||10,dm=(fx.domain.mult!=null?fx.domain.mult:0.3);hits.length=0;for(let i=0;i<dn;i++)hits.push({mult:dm});barrageN=dn;crit=false;purple=false;ranton=false;domainStrike=true;}
  bt.domainNow=domainStrike;
  /* Galaxy Roar = SATU semburan: semua damage ditumpuk ke satu sambaran supaya laser & ledakannya sinkron */
  const galaxy=id==="CH_ETERNAL_DRAGON"&&purple;
  if(galaxy){const m=hits[hits.length-1].mult;hits.length=0;hits.push({mult:m});barrageN=0;}
  const ariseMode=id==="CH_EX_JINWOO"&&barrageN>=9;
  if(bt.gunsNow)hits.push({mult:0.4});
  let total=0;const shots=[];
  hits.forEach(h=>{
    let d=Math.round(atk*dmgMult*h.mult);
    if(!pen&&efx.evasion&&t<=efx.evasion.turns&&Math.random()*100<efx.evasion.chance){shots.push({d:0,evade:true});return;}
    const pierce=!!(fx.pierce&&Math.random()*100<fx.pierce);
    if(!pen&&efx.void&&!pierce&&Math.random()*100<efx.void){shots.push({d:0,void:true});return;}
    shots.push({d,miss:false,pierce});total+=d;
  });
  const eHpNext=bt.eHp-total,foeDead=eHpNext<=0;
  const foeDownCb=()=>{if(bt&&!bt.over)foeDown();};
  performAttack({
    A:".fighter.me",D:".fighter.foe",id,fx,
    barId:"hpFoe",barTid:"hpFoeT",defMax:bt.es.hp,
    defHpStart:bt.eHp+total,defHpEnd:eHpNext,
    shots,total,crit,purple,
    ranton,domainStrike,ariseMode,barrageN,galaxy,
    onAnimEnd:foeDead?foeDownCb:null,
    recharge:(b)=>{if(!bt)return;bt.pStun=b.selfStun;bt.pDrTurns=b.selfDrTurns||b.selfStun;bt.pDr=b.selfDr||0;setTimeout(()=>floatText(".fighter.me","RECHARGE","miss"),bsMs(1200));}
  });
  bt.eHp=eHpNext;
  if(ranton&&total>0&&bt.eHp>0&&fx.ranton.stun){bt.eStun=fx.ranton.stun;}
  /* HP DRAIN: tiap serangan yang kena memotong MAX HP musuh secara permanen (compounding) */
  if(fx.hpDrain&&total>0&&bt.eHp>0){
    bt.es.hp=Math.max(1,Math.round(bt.es.hp*(1-fx.hpDrain.pct/100)));
    if(bt.eHp>bt.es.hp)bt.eHp=bt.es.hp;
    setTimeout(()=>floatText(".fighter.foe","HP DRAIN","crit"),bsMs(360));
  }
  /* WALL TITANS: tiap `every` giliran, berbaris ngasih bonus pct% ATK ke musuh (di luar serangan normal) */
  if(fx.wallTitans){bt.wtCount[a]=(bt.wtCount[a]||0)+1;if(bt.wtCount[a]%fx.wallTitans.every===0&&bt.eHp>0){const wt=Math.round(atk*fx.wallTitans.pct/100);bt.eHp-=wt;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","WALL TITANS -"+fmt(wt),"crit");}},bsMs(520));}}
  if(fx.lifesteal&&total>0){
    const ls=Math.round(total*fx.lifesteal/100);bt.pHp=Math.min(bt.pMax,bt.pHp+ls);
    setTimeout(()=>floatText(".fighter.me","+"+fmt(ls),"heal"),bsMs(300));
  }
  if(fx.burn&&total>0&&Math.random()*100<fx.burn.chance){bt.eBurn=fx.burn.turns;setTimeout(()=>floatText(".fighter.foe","BURN","burn"),bsMs(360));}
  /* PERFECT SUSANOO (low HP): di bawah ambang, serangan membakar musuh selama N giliran */
  if(fx.lowHpAura&&total>0&&bt.pHp<bt.pMax*fx.lowHpAura.below/100&&bt.eHp>0){bt.eBurn=fx.lowHpAura.burn.turns;setTimeout(()=>floatText(".fighter.foe","PERFECT SUSANOO","burn"),bsMs(360));}
  setBar("hpFoe","hpFoeT",bt.eHp+total,bt.es.hp);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
  if(bt.eBurn>0&&bt.eHp>0){
    const bPct=fx.burn?fx.burn.pct:(fx.lowHpAura?fx.lowHpAura.burn.pct:0);
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
  setTurnPill("foe","GILIRAN MUSUH");
  const id=bt.eq.char,t=bt.turn;let fx=resolveFx(bt.eq,bt.efx);
  if(bt.shadow)fx={};
  const efx=bt.efx||{};
  let eDomain=false,eArise=false,eranton=false,eGalaxy=false;
  if(bt.eStun>0){
    bt.eStun--;
    anim(".fighter.foe","hit",true);
    setTimeout(()=>floatText(".fighter.foe","STUNNED","crit"),bsMs(200));
    bt.turn++;
    schedPhase(1000,playerPhase);
    return;
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
    if(fx.dodgeAtk&&bt.dodgeStack[bt.active]<fx.dodgeAtk.max){bt.dodgeStack[bt.active]++;bt.atkBuff[bt.active]+=fx.dodgeAtk.pct;setTimeout(()=>floatText(".fighter.me","+"+fx.dodgeAtk.pct+"% ATK","heal"),bsMs(420));}
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
    if(efx.lowHpAtk&&bt.eHp<bt.es.hp*efx.lowHpAtk.below/100)eAtk=Math.round(eAtk*(1+efx.lowHpAtk.bonus/100));
    if(efx.dmgMult)edmgMult*=efx.dmgMult;
    if(efx.highHpDmg&&bt.eHp>bt.es.hp*efx.highHpDmg.above/100)edmgMult*=(1+efx.highHpDmg.bonus/100);
    const eHits=[{mult:1}];let ecrit=false,epurple=false,eBarrageN=0;
    if(efx.double&&Math.random()*100<efx.double)eHits.push({mult:1});
    if(efx.crit&&Math.random()*100<efx.crit.chance){ecrit=true;eHits[eHits.length-1].mult*=efx.crit.mult;}
    else if(Math.random()*100<BASE_CRIT.chance){ecrit=true;eHits[eHits.length-1].mult*=BASE_CRIT.mult;}
    if(efx.purple&&Math.random()*100<efx.purple.chance){epurple=true;ecrit=true;eHits[eHits.length-1].mult*=efx.purple.mult;}
    if(efx.ranton&&Math.random()*100<efx.ranton.chance){eranton=true;ecrit=true;eHits.length=0;const rh=Math.max(1,efx.ranton.hits||5),rm=efx.ranton.mult||1;for(let k=0;k<rh;k++)eHits.push({mult:rm});}
    if(efx.barrage&&Math.random()*100<efx.barrage.chance){const n=efx.barrage.min+Math.floor(Math.random()*(efx.barrage.max-efx.barrage.min+1));const bm=efx.barrage.mult||1;if(bm!==1){eHits.length=0;for(let i=0;i<n;i++)eHits.push({mult:bm});}else{while(eHits.length<n)eHits.push({mult:1});}eBarrageN=eHits.length;}
    if(eranton&&!eBarrageN)eBarrageN=eHits.length;
    if(efx.domain&&bt.eid==="CH_EX_GOJO"&&Math.random()*100<(efx.domain.chance||100)){const dn=efx.domain.min||10,dm=(efx.domain.mult!=null?efx.domain.mult:.3);eHits.length=0;for(let i=0;i<dn;i++)eHits.push({mult:dm});eBarrageN=dn;ecrit=false;epurple=false;eranton=false;eDomain=true;}
    eArise=bt.eid==="CH_EX_JINWOO"&&eBarrageN>=9;
    eGalaxy=bt.eid==="CH_ETERNAL_DRAGON"&&epurple;
    if(eGalaxy){const m=eHits[eHits.length-1].mult;eHits.length=0;eHits.push({mult:m});eBarrageN=0;}
    let etotal=0;const eShots=eHits.map(h=>{let d=Math.round(eAtk*edmgMult*h.mult);if(bt.pDrTurns>0&&bt.pDr>0){d=Math.round(d*(1-bt.pDr/100));}etotal+=d;return{d};});
    /* ROYALGUARD: damage masuk dipangkas 50% (dibalas 30% di bawah) */
    if(bt.royalNow&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*0.5));etotal=eShots.reduce((x,s)=>x+s.d,0);}
    /* PERFECT SUSANOO (low HP): damage masuk dipangkas `dr`% */
    if(fx.lowHpAura&&bt.pHp<bt.pMax*fx.lowHpAura.below/100&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*(1-fx.lowHpAura.dr/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);setTimeout(()=>floatText(".fighter.me","PERFECT SUSANOO","heal"),bsMs(320));}
    if(bt.pDrTurns>0&&bt.pDr>0){bt.pDrTurns--;setTimeout(()=>floatText(".fighter.me","DR aktif","heal"),bsMs(340));}
    /* BUNGEE GUM: tiap kali musuh KENA menempel ke Trickster (serangan masuk), tempel/renew gum 2 giliran */
    if(fx.bungeeGum&&etotal>0){bt.gumTurns=fx.bungeeGum.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","BUNGEE GUM","crit");},bsMs(300));}
    const meStart=bt.pHp;
    bt.pHp-=etotal;
    const pDead=bt.pHp<=0;
    // kartu tumbang: tag-in / kalah BARU dijalankan setelah seluruh animasi sambaran musuh selesai
    const deathStep=()=>{
      if(!bt||bt.over)return;
      if(domainOn){bt.domainNow=false;}
      bt.turn++;
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
      ranton:eranton,domainStrike:eDomain,ariseMode:eArise,barrageN:eBarrageN,galaxy:eGalaxy,galaxy:eGalaxy,
      onAnimEnd:pDead?deathStep:null,
      recharge:(b)=>{if(!bt)return;bt.eStun=b.selfStun;setTimeout(()=>floatText(".fighter.foe","RECHARGE","miss"),bsMs(1200));}
    });
    setBar("hpMe","hpMeT",meStart,bt.pMax);
    if(efx.lifesteal&&etotal>0&&bt.eHp>0){
      const lh=Math.round(etotal*efx.lifesteal/100);bt.eHp=Math.min(bt.es.hp,bt.eHp+lh);
      setTimeout(()=>floatText(".fighter.foe","+"+fmt(lh),"heal"),bsMs(280));
      setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
    }
    /* ROYALGUARD counter: balas 30% dari damage yang baru diterima ke musuh */
    if(bt.royalNow&&!pDead&&etotal>0){
      const ctr=Math.round(etotal*0.3);bt.eHp-=ctr;
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","COUNTER -"+fmt(ctr),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(560));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
    }
    if(pDead)return;
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
  {main:"CH_CELESTIAL_ORACLE",tag:"CH_ECLIPSE_WARDEN"} /* lantai 10, 20, 30 ... */
];
function towerIsBossFloor(f){return f%5===0;}
function towerBossIndex(f){return ((f/5)-1)%TOWER_BOSS_ROSTER.length;}
function towerHash(n){return (((n*2654435761)>>>0)%100000)||0;}
function towerRegularPool(){return MASTER_CARD_INDEX.filter(c=>!c.noGacha);}
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
      html+=`<div class="bench-sq foe-sq" data-tier="${w.en.tier||''}" style="border-color:${TIER_COLOR[w.en.tier]||'var(--line)'}" title="${w.en.name}"><img src="${w.en.img}" alt="${w.en.name}"><span class="bhp"><i style="width:100%"></i></span></div>`;
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
  const ICON={weather:'<img src="assets/images/icon-potion.png" onerror="this.parentNode.textContent=\'🧪\'">',mythic:'✨',luck:'🍀',speed:'⚡'};
  const item=(k,label,desc,cost)=>`<div class="inf-item">
      <div class="inf-item-ic">${ICON[k]||'🧪'}</div>
      <div class="inf-item-info"><div class="inf-item-name">${label}</div><div class="inf-item-desc">${desc}</div></div>
      <button class="inf-item-buy" ${tok<cost?'disabled':''} onclick="infBuy('${k}')">${cost}<small>TOKEN</small></button>
    </div>`;
  /* data item (teks & harga = versi live) — state dari state live */
  const ITEMS=[
    {k:"weather",label:"WEATHER POTION",sub:"SKIP cuaca sekarang ke cuaca acak lain, 5 menit (pity no-downgrade).",cost:10,req:null,ac:"var(--ice)"},
    {k:"luck",label:"LUCK POTION",sub:"+1 Luck selama 5 menit.",cost:10,req:null,ac:"var(--green)"},
    {k:"speed",label:"SPEED POTION",sub:"+1× Roll Speed selama 5 menit.",cost:10,req:null,ac:"var(--amber)"},
    {k:"mythic",label:"MYTHIC WEATHER POTION",sub:"Upgrade 1 Weather Potion -> Mythic: APOCALYPSE chance 3% (durasi 5 menit). Butuh 1 Weather Potion.",cost:50,req:"weather",ac:"var(--violet)"}
  ];
  const stkOf=k=>k==="weather"?(state.potions||0):k==="luck"?(state.luckPotions||0):k==="speed"?(state.speedPotions||0):(state.mythicPotions||0);
  if(window.shopSel==null||window.shopSel>=ITEMS.length)window.shopSel=0;
  let swapT=null;
  const renderList=()=>{
    document.getElementById("shopList").innerHTML=ITEMS.map((it,i)=>`
      <div class="srow${i===window.shopSel?" on":""}" data-i="${i}" style="--ac:${it.ac}">
        <span class="sic">${ICON[it.k]||"🧪"}</span>
        <span class="sinfo"><span class="sname">${it.label}</span><span class="ssub">${it.sub}</span></span>
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
  <div class="tw-hub">
    <section class="tw-stage">
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
  const cost={weather:10,luck:10,speed:10,mythic:50}[kind]; if(cost==null)return;
  if((state.infTokens||0)<cost){toast("TOKEN KURANG","TOKEN INF TIDAK CUKUP","#f87171");return;}
  if(kind==='mythic'&&(state.potions||0)<1){toast("Butuh 1 Weather Potion","GAK BISA","#f87171");return;}
  state.infTokens-=cost;
  if(kind==='weather')state.potions=(state.potions||0)+1;
  else if(kind==='luck')state.luckPotions=(state.luckPotions||0)+1;
  else if(kind==='speed')state.speedPotions=(state.speedPotions||0)+1;
  else if(kind==='mythic'){state.potions--;state.mythicPotions=(state.mythicPotions||0)+1;}
  save(); beep(660,.1,"sine",.07);
  const label={weather:'WEATHER POTION',luck:'LUCK POTION',speed:'SPEED POTION',mythic:'MYTHIC POTION'}[kind];
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
  bt={speed:battleSpeedEff(),lv:null,tower:true,en:w.en,es:w.es,eq,fighters,eid:w.eid,efx:w.efx,active:0,revUsed:new Array(fighters.length).fill(false),justTagged:false,pHp:base.hp,pMax:base.hp,eHp:w.es.hp,turn:1,over:false,eBurn:0,phase2used:false,domainUsed:false,domainLeft:0,eStun:0,pStun:0,pDr:0,pDrTurns:0,atkBuff:new Array(fighters.length).fill(0),dodgeStack:new Array(fighters.length).fill(0),atkCount:new Array(fighters.length).fill(0),standUsed:new Array(fighters.length).fill(false),styleCount:new Array(fighters.length).fill(0),snatchAtk:new Array(fighters.length).fill(0),snatchHp:new Array(fighters.length).fill(0),regressCharges:new Array(fighters.length).fill(0),bioGuard:new Array(fighters.length).fill(false),splitLeft:new Array(fighters.length).fill(0),splitMult:new Array(fighters.length).fill(1),burstStart:new Array(fighters.length).fill(1),entryGuard:new Array(fighters.length).fill(false),dodgeArmed:new Array(fighters.length).fill(false),dodgeCount:new Array(fighters.length).fill(0),execGuard:new Array(fighters.length).fill(false),wtCount:new Array(fighters.length).fill(0),shatterGuard:new Array(fighters.length).fill(false),defyUsed:new Array(fighters.length).fill(false),defyHold:false,openGuard:true,dsState:new Array(fighters.length).fill(0),gumTurns:0,trickNext:false,royalNow:false,gunsNow:false,shadow:null};
  const tfx=resolveFx(eq,w.efx);
  if(tfx&&tfx.entryCounter)bt.entryGuard[0]=true;
  if(tfx&&tfx.entryShatter)bt.shatterGuard[0]=true;
  if(tfx&&tfx.entryMaxHp)bt.bioGuard[0]=true;
  bt.fighters.forEach((f,i)=>{const x=resolveFx(f,w.efx);if(x.splitDeath)bt.splitLeft[i]=x.splitDeath.times;});
  schedPhase(700,step);
}
function foeDown(){
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
  }
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
function advanceTowerFoe(){
  towerRun.idx++;
  const w=towerRun.waves[towerRun.idx];
  bt.en=w.en;bt.es=w.es;bt.eid=w.eid;bt.efx=w.efx;bt.eHp=w.es.hp;
  bt.openGuard=true;bt.eBurn=0;bt.eStun=0;bt.phase2used=false;bt.domainUsed=false;bt.domainLeft=0;bt.domainNow=false;
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
    setBar("hpFoe","hpFoeT",w.es.hp,w.es.hp);
    const foeEl=side?side.querySelector(".fighter.foe"):null;
    if(foeEl){enterFx(foeEl);}
    const tl=document.getElementById("turnLabel");if(tl)tl.innerHTML="LANTAI <b>"+towerRun.floor+"</b> · GELOMBANG <b>"+(towerRun.idx+1)+"/"+towerRun.waves.length+"</b>";
    floatText(".fighter.foe","TAG-IN!","heal");
    schedPhase(1000,enemyPhase);
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
    if(Math.random()<0.10){state.luckPotions=(state.luckPotions||0)+1;towerRun.drops.luck++;}
    if(Math.random()<0.10){state.speedPotions=(state.speedPotions||0)+1;towerRun.drops.speed++;}
    /* Token Inf: +1 per lantai, +5 per lantai bos. */
    const tok=towerIsBossFloor(f)?5:1;
    state.infTokens=(state.infTokens||0)+tok; towerRun.tokens=(towerRun.tokens||0)+tok;
    towerRun.cleared=f; towerRun.coins=(towerRun.coins||0)+r.coins;
    state.tower.best=Math.max(state.tower.best||0,f);
    save(); renderShell(); fanfare();
    toast("LANTAI "+f+" DITAKLUKKAN","+"+rr+" ROLL DISIMPAN · "+"+"+tok+" TOKEN","#7df9ff");
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
function showTowerLoot(results,drops){
  const pop=document.getElementById("rollResultPop");if(!pop)return;
  results=results||[];
  const d=drops||{weather:0,luck:0,speed:0};
  const POTION=[{k:'weather',name:'WEATHER',icon:'assets/images/icon-potion.png',emoji:'🧪'},{k:'luck',name:'LUCK',icon:'assets/images/icon-luck.png',emoji:'🍀'},{k:'speed',name:'SPEED',icon:'assets/images/icon-speed.png',emoji:'⚡'}];
  const totalPot=POTION.reduce((s,p)=>s+(d[p.k]||0),0);
  if(!results.length&&!totalPot)return;
  const potChips=POTION.filter(p=>(d[p.k]||0)>0).map(p=>{const n=d[p.k]||0;return `<div class="rrc rrc-potion" title="${p.name} POTION"><i class="rrc-sizer"></i><span class="rrc-pot-ic"><img src="${p.icon}" alt="${p.name}" onerror="this.parentNode.textContent='${p.emoji}'"></span>${n>1?`<span class="rrc-cnt">×${n}</span>`:''}<span class="rrc-name">${p.name}</span></div>`;}).join("");
  const groups={};
  results.forEach(r=>{const key=r.cardId+"|"+(r.mut||"none")+"|"+(r.shiny||"none");(groups[key]=groups[key]||{cardId:r.cardId,tier:r.tier,mut:r.mut||"none",shiny:r.shiny||"none",n:0}).n++;});
  const list=Object.values(groups).sort((a,b)=>luckChance(b.cardId,b.mut,b.shiny)-luckChance(a.cardId,a.mut,a.shiny)||b.n-a.n);
  document.getElementById("rrTotal").textContent=fmt(results.length)+" kartu"+(list.length?" · "+list.length+" jenis unik":"")+(totalPot?" · "+fmt(totalPot)+" potion":"");
  document.getElementById("rrBody").innerHTML=potChips+list.map(g=>{
    const name=cardName(g.cardId),img=cardImg(g.cardId);
    const isShiny=g.shiny&&g.shiny!=="none", isMut=g.mut&&g.mut!=="none";
    const varTag=(isShiny||isMut)?`<span class="rrc-var">${isShiny?'<span class="rrc-shine">SHINY</span>':''}${isMut?`<span class="rrc-mut" style="border-color:${MUT_COLOR[g.mut]||'#fff'}">${mutBadge(g.mut)}</span>`:''}</span>`:'';
    let rc="rrc";if(isMut)rc+=" mut-"+g.mut;if(isShiny)rc+=" shiny";
    return `<div class="${rc}"><i class="rrc-sizer"></i><img src="${img}" alt="${name}" title="${name}" onerror="this.style.display='none'">${varTag}${g.n>1?`<span class="rrc-cnt">×${g.n}</span>`:''}<span class="rrc-name">1/${fmtC(luckChance(g.cardId,g.mut,g.shiny))}</span></div>`;
  }).join("");
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
  let crit=false,purple=false,ranton=false,barrageN=0;
  if(fx.double&&Math.random()*100<fx.double)hits.push(1);
  if(fx.crit&&Math.random()*100<fx.crit.chance){crit=true;hits[hits.length-1]*=fx.crit.mult;}
  else if(Math.random()*100<BASE_CRIT.chance){crit=true;hits[hits.length-1]*=BASE_CRIT.mult;}
  if(fx.purple&&Math.random()*100<fx.purple.chance){purple=true;crit=true;hits[hits.length-1]*=fx.purple.mult;}
  if(fx.ranton&&Math.random()*100<fx.ranton.chance){ranton=true;crit=true;hits.length=0;const rh=Math.max(1,fx.ranton.hits||5),rm=fx.ranton.mult||1;for(let k=0;k<rh;k++)hits.push(rm);}
  if(fx.barrage&&Math.random()*100<fx.barrage.chance){const n=fx.barrage.min+Math.floor(Math.random()*(fx.barrage.max-fx.barrage.min+1)),bm=fx.barrage.mult||1;hits.length=0;for(let i=0;i<n;i++)hits.push(bm);barrageN=hits.length;}
  if(ranton&&!barrageN)barrageN=hits.length;
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
      if(barrageN>1)setTimeout(()=>floatText(".fighter.foe",(domainActive?"UNLIMITED VOID ×":ariseMode?"ARISE ×":md?"TENSA ×":"CLEAVE ×")+barrageN,"crit"),md?MADARA_T.slash:320);
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
  <div class="raid-result">
    <div class="eyebrow">HASIL RAID${dLabel?" · "+dLabel:""}</div>
    <div class="rr-title disp${pct>=100?"":" lose"}">${pct>=100?"BOSS TUMBANG":"RAID SELESAI"}</div>
    <div class="rr-pct">Damage ke Boss <b>${pct}%</b></div>
    <div class="rr-token">+${tokens} <span>TOKEN RAID</span></div>
    <div class="rr-tier">${nx?`Butuh ${nx.pct}% damage untuk +${nx.tokens} token.`:"Semua tier terklaim!"}</div>
    <div class="rr-actions"><button class="btn-grad" id="rrAgain">RAID LAGI</button><button class="btn-ghost" id="rrHub">KEMBALI</button></div>
  </div>`;
  document.getElementById("rrAgain").onclick=()=>{sfx.hit();raidView="pick";renderRaid();};
  document.getElementById("rrHub").onclick=()=>{raidView="hub";renderRaid();};
}
function raidShopThumb(it){
  if(it.card){
    const c=CARDS[it.card.char],mut=it.card.mut||"none";
    if(!c) return `<div class="ri-thumb"><div class="ri-desc">${it.desc}</div></div>`;
    return `<div class="ri-thumb${mut!=="none"?" mut-"+mut:""}">
      <img src="${c.sprite_asset}" alt="${c.name}">
      <span class="ri-tier" style="color:${TIER_COLOR[c.tier]};border-color:${TIER_COLOR[c.tier]}">${rarityText(c.tier,c.chance)}</span>
      ${mut!=="none"?`<span class="ri-mut" style="color:${MUT_COLOR[mut]}">${MUT_LABEL[mut]}</span>`:""}
      <div class="ri-desc">${it.desc}</div>
    </div>`;
  }
  const col="#E0BC6E";
  const glyph=`<svg class="ri-glyph" viewBox="0 0 48 48" fill="none" stroke="${col}" stroke-width="2.6"><circle cx="24" cy="24" r="17" fill="${col}" fill-opacity=".22"/><circle cx="24" cy="24" r="9.5"/></svg>`;
  return `<div class="ri-thumb" style="background:radial-gradient(circle at 50% 42%,${col}2E,#EDF1F6 72%)">${glyph}<span class="ri-cap">+2.000</span><div class="ri-desc">${it.desc}</div></div>`;
}
function stackHas(char,mut){mut=mut||"none";return state.stacks.some(s=>s.char===char&&(s.mut||"none")===mut);}
const RAID_SHOP=[
  {id:"coins",name:"2.000 Coin",cost:5,desc:"Koin untuk roll trait & kebutuhan lain.",apply:()=>{state.coins+=2000;return "+2.000 coin";}},
  {id:"card_edragon",name:"Eternal Dragon",cost:120,desc:"Kartu EKSKLUSIF — hanya dijual di Toko Raid, tidak keluar dari roll.",card:{char:"CH_ETERNAL_DRAGON",mut:"none"},apply:()=>gmGrantCard("CH_ETERNAL_DRAGON")}
];
function renderRaidShop(){
  app.innerHTML=`
  <div class="eyebrow">TOKO RAID</div>
  <h1>Raid <span class="grad-text">Shop</span></h1>
  <div class="raid-shop-head"><span>TOKEN RAID: <b>${fmt(state.raidTokens||0)}</b></span><button class="btn-ghost" id="shopBack">← KEMBALI</button></div>
  <div class="raid-shop-grid">${RAID_SHOP.map(it=>{
    const have=it.card&&stackHas(it.card.char,it.card.mut);
    const tag=have?` <span class="ri-owned">· sudah di Deck</span>`:"";
    const buy=have?`<button class="ri-buy" disabled>SUDAH DIPUNYA</button>`
      :`<button class="ri-buy" data-buy="${it.id}"${(state.raidTokens||0)<it.cost?" disabled":""}>${it.cost} TOKEN</button>`;
    return `
    <div class="raid-item" tabindex="0">
      ${raidShopThumb(it)}
      <div class="ri-name">${it.name}${tag}</div>
      ${buy}
    </div>`;}).join("")}</div>
  <p class="raid-note">Dapat token dari Boss Raid. Klaim damage 30% → +5, 50% → +10, 100% → +20 token. Kartu Eternal Dragon hanya dijual di sini, tidak keluar dari gacha.</p>`;
  document.getElementById("shopBack").onclick=()=>{raidView="hub";renderRaid();};
  app.querySelectorAll("[data-buy]").forEach(btn=>btn.onclick=()=>{
    const it=RAID_SHOP.find(x=>x.id===btn.dataset.buy);
    if(!it||(state.raidTokens||0)<it.cost)return;
    if(it.card&&stackHas(it.card.char,it.card.mut))return raidToast("Kartu itu sudah ada di Deck kamu");
    state.raidTokens-=it.cost;const msg=it.apply();save();sfx.crit();renderShell();renderRaidShop();
    raidToast(msg+" · −"+it.cost+" token");
  });
}

/* =============== INDEX CARD (popup) =============== */
function openIndex(){
  /* Satu grid kotak-kotak berisi SEMUA kartu, tanpa pemisah tier & tanpa label chance.
     Klik sebuah kotak = buka detail passive lewat #skillPop (info tak hilang, cuma dipindah). */
  document.getElementById("ixBody").innerHTML=`<div class="ix-grid">${MASTER_CARD_INDEX.map(c=>{
    return `<button class="ix-cell" type="button" data-c="${c.char_id}" style="border-color:${TIER_COLOR[c.tier]||'var(--line2)'}">
      <img src="${c.sprite_asset}" alt="${c.name}">
      <span class="ixc-name">${c.name}</span>
    </button>`;}).join("")}</div>`;
  document.querySelectorAll("#ixBody .ix-cell").forEach(cell=>{
    cell.onclick=()=>{const c=CARDS[cell.dataset.c];if(!c)return;document.getElementById("spName").textContent=c.passive.name;document.getElementById("spDesc").textContent=c.passive.desc;document.getElementById("skillPop").classList.add("show");};
  });
  document.getElementById("indexModal").classList.add("show");
  document.getElementById("spClose").onclick=()=>document.getElementById("skillPop").classList.remove("show");
  document.getElementById("skillPop").onclick=(e)=>{if(e.target.id==="skillPop")document.getElementById("skillPop").classList.remove("show");};
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
