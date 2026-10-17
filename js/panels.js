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
  e.flat=def.flat;/* CAP 1x dasar level — spam gak nambah flat, cuma timer */
  e.pct=def.pct;
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
  e.add=def.add;/* CAP 1x dasar level — spam gak nambah speed, cuma timer */
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
    if(ec)ec.textContent="1 in "+fmtChance(result.chance);
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
  /* ===== ANGKA INTI: stat rows gaya referensi =====
     NOTE satuan: artefak/pet simpan pct sebagai PERSEN BULAT (200 = +200%,
     sengaja biar OP — totalLuck emang nerapin ×201, gak disentuh), tree/potion
     simpan PECAHAN (0.1 = +10%). Nampilinnya jangan dicampur / jangan ×100
     dua kali buat art+pet. */
  const base=p.luckBase??1, flat=p.luckFlat||0, treeF=treeLuckFlat(), treeP=treeLuckPct(), artF=artLuckFlat(), artP=artLuckPct(), petF=petLuckFlat(), petP=petLuckPct(), plB=activeLuckBuff(), plBP=activeLuckBuffPct();
  const pct=(p.luckPercent||0)+treeLuckPct()+plBP+artP+petP;
  const wm=weatherLuckMult();
  const lparts=["Base "+base.toFixed(1)];
  if(flat>0)lparts.push("Player +"+flat.toFixed(1));
  if(treeF>0)lparts.push("Pohon +"+treeF.toFixed(1));
  if(artF>0||artP>0)lparts.push("Artefak +"+artF.toFixed(1)+(artP>0?" / +"+Math.round(artP)+"%":""));
  if(petF>0||petP>0)lparts.push("Pet +"+petF.toFixed(1)+(petP>0?" / +"+Math.round(petP)+"%":""));
  if(plB>0||plBP>0)lparts.push("Buff +"+plB.toFixed(1)+(plBP>0?" / +"+Math.round(plBP*100)+"%":""));
  /* baris "Pct" = cuma sumber pecahan (luckPercent + tree + potion); art/pet
     (satuan persen bulat) udah tampil di barisnya sendiri — jangan digabung. */
  const pctFrac=(p.luckPercent||0)+treeP+plBP;
  if(pctFrac>0)lparts.push("Pct +"+Math.round(pctFrac*100)+"%");
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
    +row("ITEM LUCK","+"+(artF+petF).toFixed(1)+((artP+petP)>0?" / +"+Math.round(artP+petP)+"%":""))
    +row("ROLL SPEED",eff.toFixed(1)+"×");

  /* ===== PARTY: pet + 2 artefak + kartu utama (portrait + pill) ===== */
  const pslot=(img,label,pill,name)=>`<div class="prof-slot${img?"":" empty"}" title="${name}">${img?`<img src="${img}" alt="">`:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>'}<span class="ps-lab">${label}</span><span class="ps-pill">${pill}</span></div>`;
  const pd=state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;
  const slots=[];
  slots.push(pslot(pd?`assets/pets/${pd.id}.png`:"","PET",pd?`+${pd.flat||0}${pd.pct?" / +"+Math.round(pd.pct)+"%":""}`:"KOSONG",pd?pd.name:"Pet kosong"));
  [0,1].forEach(i=>{
    const aid=state.artSlots&&state.artSlots[i];
    const ad=aid?ART_DEFS.find(x=>x.id===aid):null;
    slots.push(pslot(ad?(ad.img||""):"","ARTEFAK "+(i+1),ad?`+${ad.flat||0}${ad.pct?" / +"+ad.pct+"%":""}`:"KOSONG",ad?ad.name:"Artefak kosong"));
  });
  slots.push(pslot(cid?cardImg(cid):"","KARTU",cid?`1 IN ${fmtChance(effChance(cid,eq.mut||"none",!!eq.shiny))}`:"KOSONG",cid?cardName(cid):"Tanpa kartu"));
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
function bpCardBorderColor(s){if(s.mut&&s.mut!=="none"&&MUT_COLOR[s.mut])return MUT_COLOR[s.mut];if(s.shiny)return "#7DF9FF";return "var(--line2)";}
function bpCardBorderKind(s){if(s.shiny&&s.mut&&s.mut!=="none"&&MUT_COLOR[s.mut])return "shiny-"+s.mut;if(s.mut&&s.mut!=="none"&&MUT_COLOR[s.mut])return s.mut;if(s.shiny)return "shiny";return "";}
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
    const edge=bpCardBorderColor(s),variant=bpCardBorderKind(s),variantClass=variant?" bp-mut-"+variant:"",edgeStyle=variant?"":";border-color:"+edge;
    return `<div class="bp-slot filled${bpTarget===i?' sel':''}${variantClass}" data-sid="${s.id}" onclick="bpPickSlot(${i})" style="--tcol:${edge}${edgeStyle}"><img src="${cardImg(s.char)}" alt=""><span class="bps-num">${i+1}</span><button class="bps-x" onclick="event.stopPropagation();bpClearSlot(${i})">&times;</button></div>`;
  }).join('');
  const pOf=s=>{const st=cardStats(s.char,s.mut,s.trait,s.shiny);return st.hp+st.atk;};
  const visible=state.stacks.filter(bpMatchesMut).sort((a,b)=>(b.fav?1:0)-(a.fav?1:0)||pOf(b)-pOf(a)||luckChance(b.char,b.mut,b.shiny)-luckChance(a.char,a.mut,a.shiny)); /* favorit → terkuat → paling langka */
  const tiles=visible.map(s=>{
    const inDeck=state.deck.includes(s.id);
    const shny=s.shiny?'<span class="bpt-shiny">SHINY</span>':'';
    const mut=(s.mut&&s.mut!=='none')?s.mut:null;
    const trait=(s.trait&&s.trait!=='none')?s.trait:null;
    const cnt=(s.count||1)>1?`<span class="bpt-cnt">&times;${fmt(s.count)}</span>`:'';
    const stack=(shny||mut||trait)?`<div class="bpt-top">${shny}${mut?mutChip(mut,`<span class="bpt-mut" style="border-color:${MUT_COLOR[mut]}">${mutBadge(mut)}</span>`):''}${trait?traitChip(trait,`<span class="bpt-gem" style="border-color:${TRAIT_COLOR[trait]}">${traitGem(12,trait)}</span>`):''}</div>`:'';
    const edge=bpCardBorderColor(s),variant=bpCardBorderKind(s),variantClass=variant?" bp-mut-"+variant:"";
    return `<div class="bp-tile${inDeck?' in-deck':''}${variantClass}" data-sid="${s.id}" data-name="${cardName(s.char).toLowerCase()}" onclick="bpAssign('${s.id}')" style="--tcol:${edge}"><img src="${cardImg(s.char)}" alt="">${stack}${cnt}<div class="bpt-ctl"><button class="bpt-fav${s.fav?' on':''}" onclick="event.stopPropagation();bpFav('${s.id}')" title="Favorit">${s.fav?'★':'☆'}</button><button class="bpt-lock${s.lock?' on':''}" onclick="event.stopPropagation();bpLock('${s.id}')" title="Lock">${s.lock?'🔒':'🔓'}</button></div><div class="bpt-name">${cardName(s.char)}</div></div>`;
  }).join('');
  const cntOf=m=>state.stacks.filter(s=>m==='all'?true:(m==='shiny'?!!s.shiny:(s.mut||'none')===m)).length;
  const chip=(k,lbl)=>{const on=bpMutFilter===k,themed=['shiny','gold','rainbow','secret'].includes(k);const col=!on&&!themed?(MUT_COLOR[k]||'#7DF9FF'):'';return `<button class="bp-fchip${themed?' bp-themed bp-'+k:''}${on?' on':''}" onclick="bpSetFilter('${k}')"${col?` style="border-color:${col};color:${col}"`:''}>${themed?'<span class="bp-fchip-label">'+lbl+'</span>':lbl}<em>${cntOf(k)}</em></button>`;};
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
