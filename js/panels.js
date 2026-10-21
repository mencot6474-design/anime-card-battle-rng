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

/* Helper render ikon vektor SVG cyberpunk untuk tiap cuaca (menggantikan native emoji) */
function weatherSvg(id, sz=18){
  const s = sz;
  switch(id){
    case "awakened": // All-seeing eye / cyber iris
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><path d="M12 9v1m0 4v1"/></svg>`;
    case "arcane": // Magic sphere / arcane crystal
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="m4.93 4.93 4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M4.93 19.07l4.24-4.24"/></svg>`;
    case "goofy": // Wild sparkle / flame
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
    case "glitch": // Digital monitor / glitch beam
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="15" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="18" y2="21"/><path d="m7 8 2 4-3 1 5 1"/></svg>`;
    case "doodle": // Palette / cyber art
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`;
    case "eclipse": // Moon / eclipse corona
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1Z"/><path d="M19 3v4M21 5h-4"/></svg>`;
    case "iceage": // Ice cube / crystal prism
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 16-4 4-4-4 4-4 4 4ZM7 16l-4 4-4-4 4-4 4 4Zm7-8-4 4-4-4 4-4 4 4Z"/><path d="m14 12-4-4 4-4M10 20l4-4-4-4"/></svg>`;
    case "galactic": // Orbit ring / planet
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M3.5 12a14.5 5 0 1 0 17 0 14.5 5 0 1 0-17 0"/></svg>`;
    case "aurora": // Northern waves / cosmic veil
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10c3-3 6-3 9 0s6 3 9 0"/><path d="M2 14c3-3 6-3 9 0s6 3 9 0"/><path d="M2 18c3-3 6-3 9 0s6 3 9 0"/></svg>`;
    case "monsoon": // Ocean tidal wave
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`;
    case "sandstorm": // Vortex / tornado
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H3M18 8H6M19 12H9M16 16h-6M14 20h-4"/></svg>`;
    case "thunderstorm": // Cloud lightning storm
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="m13 15-3 5h4l-2 4"/></svg>`;
    case "snowfall": // Snowflake
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/></svg>`;
    case "lightrain": // Cloud drizzle
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 19v2M8 13v2M12 21v2M12 15v2M16 19v2M16 13v2"/></svg>`;
    case "windy": // Wind gusts
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>`;
    default:
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
  }
}
/* Rank 0..N berdasar dropWeight ASC (paling langka = rank 0 = paling BAGUS). Dipakai buat stat weatherBest (cuaca terbaik pernah) + banding hasil gacha potion (rank hasil <= rank aktif = pindah + reset timer; lebih = cuaca tetep). */
function weatherRank(id){const s=[...WEATHERS].sort((a,b)=>a.dropWeight-b.dropWeight);return s.findIndex(w=>w.id===id);}
function betterWeather(a,b){if(!a)return b;if(!b)return a;return weatherRank(a)<=weatherRank(b)?a:b;}
/* Weather yang SEKARANG aktif (null kalau belum/gampang window 5 menit udah lewat). Auto-clear saat kedaluwarsa. */
function activeWeatherId(){if(!state||!state.weather)return null;if(Date.now()>=state.weather.endsAt){state.weather=null;return null;}return state.weather.id;}
function weatherLuckMult(){const id=activeWeatherId();return id?WEATHER[id].luckBonus:1;}
function weatherSpeedMult(){const id=activeWeatherId();return id?WEATHER[id].speedBonus:1;}
/* ====== SKILL TREE: 1 SP tiap naik LV. SATU pohon, DUA cabang (LUCK & SPEED).
   Node nyambung dari ROOT -> bisa ngocor satu cabang atau bagi dua; SP = tradeoff.
   luck nambah luckFlat, speed nambah pengali roll-speed permanen (total kena cap 20x). ====== */
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
  {id:"sp5",   branch:"speed",tier:5,name:"CAHAYA",        cost:15,luck:0,  speed:1.2,req:["sp4"],                desc:"Mentok jalur speed pohon (kumulatif 5.0×) — total roll speed bisa lebih tinggi +potion/cuaca."},
  /* ===== LUCK BOOSTER (panel ketiga, butuh lk5 & sp5 terbuka dulu) ===== */
  {id:"bst1",  branch:"booster",tier:1,name:"AMPLIFIKASI I",   cost:10,luck:50, luckPct:0.25,speed:0, req:["lk5","sp5"], desc:"Booster pertama — daya luck meledak. +50 flat · +25% pengali."},
  {id:"bst2",  branch:"booster",tier:2,name:"AMPLIFIKASI II",  cost:10,luck:50, luckPct:0.25,speed:0, req:["bst1"],      desc:"Gelombang kedua amplifikasi luck. +50 flat · +25% pengali."},
  {id:"bst3",  branch:"booster",tier:3,name:"AMPLIFIKASI III", cost:10,luck:50, luckPct:0.25,speed:0, req:["bst2"],      desc:"Tiga lapis resonansi luck. +50 flat · +25% pengali."},
  {id:"bst4",  branch:"booster",tier:4,name:"AMPLIFIKASI IV",  cost:10,luck:50, luckPct:0.25,speed:0, req:["bst3"],      desc:"Hampir puncak — luck mendidih. +50 flat · +25% pengali."},
  {id:"bst5",  branch:"booster",tier:5,name:"SINGULARITAS",    cost:20,luck:100,luckPct:0.50,speed:0, req:["bst4"],      desc:"Puncak pohon booster — luck menembus batas. +100 flat · +50% pengali."},
];
const TREE=Object.fromEntries(TREE_NODES.map(n=>[n.id,n]));
function treeOwned(id){return !!(state&&state.player&&state.player.tree&&state.player.tree[id]);}
function treeLuckFlat(){let s=0;for(const n of TREE_NODES){if(treeOwned(n.id))s+=(n.luck||0);}return s;}
function treeLuckPct(){let s=0;for(const n of TREE_NODES){if(treeOwned(n.id))s+=(n.luckPct||0);}return s;}
function playerSpeedMult(){let s=1;for(const n of TREE_NODES){if(treeOwned(n.id))s+=(n.speed||0);}s+=activeSpeedBuff();return Math.min(20,s);}
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
  const cards=MASTER_CARD_INDEX.filter(c=>c.weatherOnly===id);
  if(!w){panel.classList.remove("show");panel.innerHTML="";return;}
  panel.style.setProperty("--wc",w.color);
  panel.innerHTML=`<div class="wp-cyber-glow"></div>
  <div class="wp-compact-head">
    <div class="wp-compact-info">
      <span class="wp-radar-dot" style="background:${w.color};box-shadow:0 0 8px ${w.color}"></span>
      <span class="wp-ic" style="color:${w.color}">${weatherSvg(w.id, 16)}</span>
      <span class="wp-name-txt">${w.name}</span>
      <span class="wp-rarity-badge" style="--rc:${w.color}">${w.rar}</span>
    </div>
    <div class="wp-timer">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span class="wp-timer-val">${fmtCountdown(state.weather.endsAt-Date.now())}</span>
    </div>
  </div>`
    +(cards.length?`<div class="wp-cards">`+cards.map(c=>
        `<div class="wc-slot active" data-wc="${c.char_id}" style="--wc:${w.color}">
          <span class="idx-art"><img src="${c.sprite_asset}" alt=""></span>
          <span class="idx-body"><span class="wc-chance">${rarityText(c.tier,luckChance(c.char_id))}</span></span>
        </div>`).join("")+`</div>`:"")
    +`<div class="wp-buff">
      <div class="wp-buff-chip luck">
        <span class="wp-buff-sub">LUCK</span>
        <span class="wp-buff-val"><b>${w.luckBonus}×</b></span>
      </div>
      <div class="wp-buff-chip speed">
        <span class="wp-buff-sub">SPEED</span>
        <span class="wp-buff-val"><b>${w.speedBonus}×</b></span>
      </div>
    </div>`;
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
  if(!ls.length&&!ss.length){el.classList.remove("show");el.innerHTML="";return;}
  /* Slot chip: badge timer countdown di atas + ikon tengah. emoji = fallback kalau img gagal.
     Tooltip hover (bukan title native): main = nama, sub = deskripsi passive + sisa waktu. */
  const chip=(cls,src,emoji,main,sub,ms)=>`<div class="bd-chip ${cls}">
      <span class="bd-badge" data-ends="${Date.now()+ms}">${fmtCountdown(ms)}</span>
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
    if(!silent){toast(`<span style="display:inline-flex;align-items:center;gap:8px">${weatherSvg(w.id,22)} ${w.name}</span>`,"CUACA BERUBAH · 30 MENIT",w.color);beep(520,.14,"sine",.06);setTimeout(()=>beep(700,.16,"sine",.06),130);}
    return w;
  };
  window.ensureWeather=ensureWeather;
  ensureWeather(true);           /* seed cuaca pertama pas boot (tanpa toast) */
  renderShell();                 /* refresh UI dgn weather sudah ada */
  setInterval(()=>{
    if(!state)return;
    const hadActive=!!state.weather&&Date.now()<state.weather.endsAt;
    const changed=ensureWeather(false);   /* auto-rotate: habis -> roll baru + toast */
    if(changed||(!hadActive&&state.weather)){
      /* cuaca/buff berubah -> full rebuild + sync shell */
      renderWeatherDock();renderBuffDock();renderShell();
    }else{
      /* cuaca tidak berubah -> update hanya countdown timer (tanpa rebuild panel) */
      const wp=document.querySelector(".wp-timer-val");if(wp&&state.weather)wp.textContent=fmtCountdown(state.weather.endsAt-Date.now());
      document.querySelectorAll(".bd-badge").forEach(b=>{
        /* badge timer buff: update teks countdown dari data-ends (disimpan saat render) */
        const ends=b.getAttribute("data-ends");if(ends)b.textContent=fmtCountdown(+ends-Date.now());
      });
    }
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
// FIX A+B (ROLL_RARE_DEN di data.js): bobot per varian =
//   rare (den chance×mut×shiny ≥ 50.000): w = luck/den → LABEL = PELUANG ASLI + luck ngefek langsung (khusus rare);
//   common (< 50.000): w = K/den → common MENYERAP sisa peluang pool (K dari rollCommonScale()) biar total 100%.
// Di L=1 Σ bobot = 1 persis → angka "1 in X" di layar = probabilitas beneran (lihat effChance).
// Mutasi/shiny relatif tetap presisi (gold 5× lebih langka dari varian none kartu sama) di luck berapa pun.
function rngRoll(luckMultiplier=1,speedMultiplier=1){
  const L=(typeof luckMultiplier==="number"&&luckMultiplier>0)?luckMultiplier:1;
  const aw=activeWeatherId();
  const pool=gachaPool();
  if(!pool.length)return null;
  const MUTS=["none","gold","rainbow","secret","ultima"];
  const entries=[];
  for(const c of pool){
    const base=c.chance||chanceOf(c.tier);
    for(const shiny of [false,true]){
      for(const mut of MUTS){
        const statMult=(shiny?SHINY_MULT:1)*(MUT_MULT[mut]||1);
        const chanceMult=(shiny?SHINY_CHANCE_MULT:1)*(MUT_CHANCE_MULT[mut]||1);
        entries.push({card:c,mut,shiny,ch:base*chanceMult,m:statMult});
      }
    }
  }
  const K=rollCommonScale(); /* Fix A+B: common discale biar Σ peluang pool = 100% */
  let total=0;
  const weights=entries.map(e=>{const w=(e.ch>=ROLL_RARE_DEN?L:K)/e.ch;total+=w;return w;});
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
let rollState = { active: false, interval: null, currentCard: null, luck: 1, speedMultiplier: 1, hideTimer: null, fadeTimer: null, hideOverlay: false };
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
const IDX_MILESTONE=15;
function idxVariantKey(s){return s.char+"|"+(s.mut||"none")+"|"+(s.shiny?1:0);}
function idxProgress(){
  const owned=new Set((state&&state.stacks||[]).map(idxVariantKey));
  const total=(typeof MASTER_CARD_INDEX!=="undefined"?MASTER_CARD_INDEX.filter(c=>!c.isStoryEnemy).length:0)*8;
  const count=owned.size;
  return {owned:owned,count:count,total:total,blocks:Math.floor(count/IDX_MILESTONE),claimed:(state&&state.idxRewardsClaimed)||0};
}
function idxRewardSync(silent){
  // Hanya read progress, klaim dilakukan manual oleh pemain lewat tombol di Index footer
  return 0;
}
function claimIndexReward(){
  if(!state)return;
  const P=idxProgress();
  const gain=P.blocks-P.claimed;
  if(gain<=0){
    toast("BELUM BISA KLAIM","Kumpulkan 15 varian index untuk klaim!","#f87171");
    return;
  }
  state.idxRewardsClaimed=P.blocks;
  state.rollPacks=state.rollPacks||{};
  state.rollPacks.r5k=(state.rollPacks.r5k||0)+gain;
  save();
  beep(640,.16,"triangle",.09);setTimeout(()=>beep(960,.22,"triangle",.08),120);
  toast("INDEX REWARD DIKLAIM!","+"+gain+" INSTAN ROLL 5.000 PACK · CEK BACKPACK","#FFD700");
  if(typeof ixRender==="function")ixRender();
}
window.claimIndexReward=claimIndexReward;
/* Versi cepat instantRoll untuk jumlah besar: bobot tiap varian dibangun SEKALI,
   pemilihan lewat binary search prefix (bukan rngRoll berulang) — 100k roll dalam hitungan detik. */
function instantRollFast(n){
  if(!(n>0))return [];
  const L=(typeof totalLuck==="function"&&totalLuck()>0)?totalLuck():1;
  const aw=activeWeatherId();
  const pool=gachaPool();
  const MUTS=["none","gold","rainbow","secret","ultima"];
  const K=rollCommonScale(); /* Fix A+B — bobot WAJIB sama persis dengan rngRoll */
  const entries=[];const cum=[];let total=0;
  for(const c of pool){
    const base=c.chance||chanceOf(c.tier);
    for(const shiny of [false,true])for(const mut of MUTS){
      const statMult=(shiny?SHINY_MULT:1)*(MUT_MULT[mut]||1);
      const chanceMult=(shiny?SHINY_CHANCE_MULT:1)*(MUT_CHANCE_MULT[mut]||1);
      const ch=base*chanceMult;
      total+=(ch>=ROLL_RARE_DEN?L:K)/ch; /* Fix A+B — sama dengan bobot rngRoll */
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
  // luckPinned: luck EKSPLISIT dari argumen dipertahankan; tanpa argumen, dihitung ulang tiap rollTick.
  rollState.luckPinned=(typeof luck === "number" && luck > 0)?luck:null;
  rollState.luck = rollState.luckPinned||rollLuckNow();
  rollState.speedBase=(typeof speedMultiplier==="number"&&speedMultiplier>0)?speedMultiplier:1;
  // Clamp speed multiplier → jangan pernah di bawah RNG_ROLL_MIN (75ms). Speed pohon + potion + cuaca, cap 20x.
  rollState.speedMultiplier = rollSpeedNow();
  rollState.active = true;
  rollState.hideOverlay = false;

  const rollBtn = document.getElementById('rollBtn');
  if (rollBtn) rollBtn.classList.add('active');
  const ra = document.getElementById('rollAutoBtn');
  if (ra) ra.classList.add('on');
  if (rollState.hideTimer) { clearTimeout(rollState.hideTimer); rollState.hideTimer = null; }

  // Set initial delay based on speed multiplier
  const initialDelay = Math.max(RNG_ROLL_MIN, RNG_ROLL_SPEED / rollState.speedMultiplier);
  
  rollState.interval = setTimeout(rollTick, initialDelay);
}

/* ===== RECOMPUTE SPEED/LUCK TIAP TICK (fix: buff di tengah roll langsung ngefek) =====
   Dulu roll pakai setInterval(delay tetap) → speed/luck potion, skill tree, cuaca, pet
   & artefak yang berubah DI TENGAH roll baru ngefek setelah stop → auto lagi.
   Sekarang rollTick jadwal-ulang dirinya sendiri (setTimeout) dan menghitung ulang
   luck & speed dari state TERKINI tiap iterasi → semua sumber buff ikut otomatis. */
function rollLuckNow(){return totalLuck();}
function rollSpeedNow(){
  const base=(rollState&&rollState.speedBase)||1;
  return Math.max(1,Math.min(base*playerSpeedMult()*weatherSpeedMult(),RNG_ROLL_MAX_MULT));
}
function rollTick(){
  if(!rollState.active)return;
  rollState.luck=rollState.luckPinned||rollLuckNow();
  rollState.speedMultiplier=rollSpeedNow();
  const result=rngRoll(rollState.luck,rollState.speedMultiplier);
  if(!result){stopRollAnimation();hideRollResult();return;}
  // Tambah EXP (50/roll), simpan di state.player.exp
  if(state&&state.player){
    state.player.exp=(state.player.exp||0)+50;
  }
  showRollResult(result);
  renderShell(); // Update XP bar & level check
  grantRolledCard(result.cardId,result.mut,result.shiny);
  if(rollState.active)rollState.interval=setTimeout(rollTick,Math.max(RNG_ROLL_MIN,RNG_ROLL_SPEED/rollState.speedMultiplier));
}

function stopRollAnimation() {
  rollState.active = false;
  if (rollState.interval) {
    clearTimeout(rollState.interval);
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
  if (rollState.hideOverlay) return;
  const showcase = overlay.querySelector('.roll-card-showcase');
  if (!showcase) return;
  /* fix race: batalkan fade-out pending - timeout lama jangan nutup reveal baru */
  if (rollState.fadeTimer) { clearTimeout(rollState.fadeTimer); rollState.fadeTimer = null; }
  showcase.style.opacity=''; showcase.style.transform=''; showcase.style.transition='';
  const cardData = getCardData(result.cardId);
  if (!cardData) return;
  rollState.currentCard = result;

  // Kartu hasil roll = SALINAN persis kartu lobby (hubCardHtml) supaya posisinya identik.
  const eq = {char:result.cardId, mut:result.mut||"none", shiny:!!result.shiny, trait:"none"};
  showcase.innerHTML = hubCardHtml(eq, null, true);
  const mut = eq.mut!=="none" ? eq.mut : null;
  showcase.style.borderColor = mut ? MUT_COLOR[mut] : (TIER_COLOR[CARDS[eq.char].tier] || "var(--cyan)");
  showcase.style.setProperty('--tcol', mut ? (MUT_COLOR[mut] || '#7DF9FF') : (TIER_COLOR[CARDS[eq.char].tier] || '#7DF9FF'));

  // Buka overlay. Animasi masuk HANYA sekali (saat pertama tampil) supaya tidak flicker muncul-hilang tiap tick.
  const wasVisible = overlay.style.display === 'flex';
  overlay.style.display = 'flex';
  // Cinematic reveal (port dari _tmp/reveal-proto): slam + flash + particles - hanya saat baru buka
  if (!wasVisible) {
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
function openProfileModal(){
  const b=document.getElementById("profBackdrop");const m=document.getElementById("profModal");if(b){b.classList.add("show");b.style.display="block";}if(m){m.classList.add("show");m.style.display="flex";renderProfile();}
}
function closeProfileModal(){const b=document.getElementById("profBackdrop");const m=document.getElementById("profModal");if(b){b.classList.remove("show");b.style.display="none";}if(m){m.classList.remove("show");m.style.display="none";}}

// Modal Titles Cyberpunk
function openTitlesModal(){
  const b=document.getElementById("titlesBackdrop"), m=document.getElementById("titlesModal");
  if(b){b.classList.add("show");b.style.display="block";}
  if(m){m.classList.add("show");m.style.display="flex";renderTitlesModal();}
  const closeBtn=document.getElementById("titlesClose");
  if(closeBtn)closeBtn.onclick=closeTitlesModal;
  if(b)b.onclick=closeTitlesModal;
}
function closeTitlesModal(){
  const b=document.getElementById("titlesBackdrop"), m=document.getElementById("titlesModal");
  if(b){b.classList.remove("show");b.style.display="none";}
  if(m){m.classList.remove("show");m.style.display="none";}
}
function equipTitle(titleKey){
  state.playerTitle = titleKey;
  save();
  renderTitlesModal();
  renderProfile();
  if(location.hash==="#/lobby"&&typeof render==="function")render();
  toast("TITLE EQUIPPED", `[${titleKey}] AKTIF SEBAGAI MAHKOTA KARTU`, "#7df9ff");
}
function renderTitlesModal(){
  if(!state)return;
  const p=state.player||{};
  const lv=p.lv||state.playerLv||1;
  const curT=state.playerTitle || "ROOKIE";
  const uni=new Set((state.stacks||[]).map(s=>s.char));
  const shiny=(state.stacks||[]).filter(s=>s.shiny).length;
  const raidDone=Object.values(state.raidCleared||{}).filter(Boolean).length;

  const TITLE_DEFS=[
    {id:"ROOKIE",name:"ROOKIE",cls:"title-rookie",desc:"Gelar permulaan petualang",unlocked:true},
    {id:"COLLECTOR",name:"COLLECTOR",cls:"title-collector",desc:"Koleksi 10 kartu unik",unlocked:uni.size>=10},
    {id:"SHINY HUNTER",name:"SHINY HUNTER",cls:"title-shiny_hunter",desc:"Dapatkan minimal 1 kartu Shiny",unlocked:shiny>=1},
    {id:"TOWER CLIMBER",name:"TOWER CLIMBER",cls:"title-tower_climber",desc:"Capai lantai 10 Infinite Tower",unlocked:((state.tower&&state.tower.best)||0)>=10},
    {id:"RAID SLAYER",name:"RAID SLAYER",cls:"title-raid_slayer",desc:"Kalahkan minimal 1 Boss Raid",unlocked:raidDone>=1},
    {id:"ELITE",name:"ELITE",cls:"title-elite",desc:"Capai Level Operator 25",unlocked:lv>=25}
  ];

  // Update Preview Box
  const pBox=document.getElementById("tmPreviewBox");
  if(pBox){
    const activeDef=TITLE_DEFS.find(x=>x.id===curT)||TITLE_DEFS[0];
    pBox.innerHTML=renderTitleCrownHtml(activeDef.name, activeDef.cls);
  }

  // Update List Grid
  const listGrid=document.getElementById("titlesListGrid");
  if(listGrid){
    listGrid.innerHTML=TITLE_DEFS.map(t=>{
      const isEq=(t.id===curT);
      const cardCls=isEq?"equipped":t.unlocked?"unlocked":"locked";
      let btnHtml="";
      if(isEq){
        btnHtml=`<button class="tm-action-btn btn-active" disabled>EQUIPPED</button>`;
      }else if(t.unlocked){
        btnHtml=`<button class="tm-action-btn btn-equip" onclick="equipTitle('${t.id}')">EQUIP</button>`;
      }else{
        btnHtml=`<button class="tm-action-btn btn-locked" disabled>LOCKED</button>`;
      }
      return `<div class="tm-card ${cardCls}">
        <div class="tm-info">
          <div class="tm-c-name">${t.name}</div>
          <div class="tm-c-desc">${t.desc}</div>
        </div>
        ${btnHtml}
      </div>`;
    }).join("");
  }
}
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
    if(state&&state.customAvatar){
      av.innerHTML=`<img src="${state.customAvatar}" alt="Custom Avatar">`;
    }else{
      const art=(cid&&CARDS[cid])?cardImg(cid):"";
      if(art){
        const pos=CARDS[cid].pos?` style="object-position:${CARDS[cid].pos}"`:"";
        av.innerHTML=`<img src="${art}" alt=""${pos}>`;
      }else{
        av.innerHTML='<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6.5 8-6.5S20 16 20 20"/></svg>';
      }
    }
  }
  set("pfName",currentUser||"GUEST");
  set("pfDeck",cid?("KARTU UTAMA · "+cardName(cid)):"KARTU UTAMA · —");
  set("pfLv",lv);
  const xf=document.getElementById("pfXpFill");if(xf)xf.style.width=xpPct+"%";
  set("pfXpText",`${fmt(curExp)} / ${fmt(xpNeed)} · ${xpPct}%`);
  const curT = state.playerTitle || "ROOKIE";
  set("pfTitleTag", `[${curT}]`);
  const tb=document.getElementById("pfTitlesBtn");
  if(tb)tb.onclick=()=>{ openTitlesModal(); };
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
  const bsNext=bsMax<4?("Berikutnya: "+(bsMax===1?"LV10 → 2×":bsMax===2?"LV25 → 3×":"LV50 → 4×")):"Semua kecepatan terbuka";
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
    +tile("ROLL SPEED",eff.toFixed(1)+"×",sparts.length?sparts.join(" · ")+" · cap ×20":"Tanpa bonus · cap ×20")
    +tile("BATTLE SPEED",battleSpeedEff()+"×",`Maks ${bsMax}× · ${bsNext}`)
    +tile("TOTAL POWER",fmt(totalPower()),"HP + ATK deck aktif")
    +tile("TOTAL SUMMON",fmt(state.summons||0),"pull sepanjang masa");
  /* ===== KOLEKSI: dari state.stacks ===== */
  const st=Array.isArray(state.stacks)?state.stacks:[];
  let copies=0, shiny=0, gold=0, rainbow=0, secret=0, ultima=0; const uni=new Set();
  for(const s of st){const c=s.count||1;copies+=c;uni.add(s.char);
    if(s.shiny)shiny+=c;const m=s.mut||"none";
    if(m==="gold")gold+=c;else if(m==="rainbow")rainbow+=c;else if(m==="secret")secret+=c;else if(m==="ultima")ultima+=c;}
  const totalCards=MASTER_CARD_INDEX.filter(c=>!c.isStoryEnemy).length;
  const uniPct=totalCards?Math.round(uni.size/totalCards*100):0;
  const koleksi=
    tile("KARTU UNIK",`${uni.size} / ${totalCards}`,`progres koleksi ${uniPct}%`)
    +tile("TOTAL COPY",fmt(copies),"seluruh salinan kartu")
    +tile("SHINY",fmt(shiny),"salinan shiny")
    +tile("GOLD",fmt(gold),"mutasi gold")
    +tile("RAINBOW",fmt(rainbow),"mutasi rainbow")
    +tile("SECRET",fmt(secret),"mutasi secret")
    +tile("ULTIMA",fmt(ultima),"mutasi ultima");
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
    +tile("CUACA AKTIF",wAct?`<span style="display:inline-flex;align-items:center;gap:6px;color:${wAct.color}">${weatherSvg(wAct.id,16)} ${wAct.name}</span>`:"TIDAK AKTIF",wSub,"wide")
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
  rollState.hideOverlay = true;
  const overlay = document.getElementById('rollOverlay');
  if (!overlay) return;

  const showcase = overlay.querySelector('.roll-card-showcase');
  if (showcase) {
    showcase.classList.remove('rv-slam');
    showcase.style.transition = 'all 0.3s ease-out';
    showcase.style.opacity = '0';
    showcase.style.transform = 'scale(0.8)';
  }

  rollState.fadeTimer = setTimeout(() => {
    rollState.fadeTimer = null;
    overlay.style.display = 'none';
    if (showcase) {
      showcase.style.opacity = '';
      showcase.style.transform = '';
      showcase.style.transition = '';
      showcase.style.bottom = '';
    }
  }, 300);
}

/* ========== DECK MANAGER (panel Backpack) ==========
   Backpack = editor dek 4 slot berbasis state.stacks + state.deck.
   Tile koleksi dibuat KECIL & TANPA info stat biar muat banyak.
   Alur: klik slot => jadikan target; klik tile koleksi => pasang ke target (atau slot kosong pertama). */
let bpTarget = null;
let bpMutFilter = "all"; /* filter varian koleksi: all|none|gold|rainbow|secret|shiny */
let bpTab = "deck"; /* tab Backpack: deck | item | artefact | pet */
function bpSetTab(t){bpTab=t;bpTarget=null;bpItemPopClose();renderBackpackPanel();}
function deckTotalPower(){return totalPower();} /* delegate ke totalPower() — satu sumber, sinkron selamanya */
function bpPickSlot(i){bpTarget=(bpTarget===i?null:i);renderBackpackPanel();}
function bpSetFilter(m){bpMutFilter=m;renderBackpackPanel();}
function bpMatchesMut(s){return bpMutFilter==="all"||(bpMutFilter==="shiny"?!!s.shiny:(s.mut||"none")===bpMutFilter);}
function bpCardBorderColor(s){if(s.mut&&s.mut!=="none"&&MUT_COLOR[s.mut])return MUT_COLOR[s.mut];if(s.shiny)return "#7DF9FF";return "var(--line2)";}
function bpCardBorderKind(s){if(s.shiny&&s.mut&&s.mut!=="none"&&MUT_COLOR[s.mut])return "shiny-"+s.mut;if(s.mut&&s.mut!=="none"&&MUT_COLOR[s.mut])return s.mut;if(s.shiny)return "shiny";return "";}
function bpClearSlot(i){setDeckSlot(i,null);bpTarget=null;renderBackpackPanel();if(!state.battle&&typeof render==="function")render();}
function bpAssign(stackId){
  const s=state.stacks.find(x=>x.id===stackId);if(!s)return;
  let slot=bpTarget;
  if(slot==null)slot=state.deck.indexOf(null);
  if(slot<0)slot=0;                 /* dek penuh: timpa slot pertama */
  setDeckSlot(slot,s.id);
  bpTarget=null;
  renderBackpackPanel();
  if(!state.battle&&typeof render==="function")render();
}
function bpFav(stackId){const s=state.stacks.find(x=>x.id===stackId);if(!s)return;s.fav=!s.fav;save();renderBackpackPanel();}
function bpLock(stackId){const s=state.stacks.find(x=>x.id===stackId);if(!s)return;s.lock=!s.lock;save();renderBackpackPanel();}
function renderBackpackPanel(){
  const panel=document.getElementById('backpackPanel');if(!panel)return;
  bpsHoverBind();bpsHoverHide();
  const TABS=[{k:'deck',l:'DECK MATRIX'},{k:'tree',l:'SKILL TREE'},{k:'item',l:'POTION & ITEMS'},{k:'artefact',l:'ARTEFACTS'},{k:'pet',l:'COMPANION PETS'}];
  const tabbar=`<div class="bp-tabs">${TABS.map(t=>`<button class="bp-tab${bpTab===t.k?' on':''}" onclick="bpSetTab('${t.k}')">${t.l}</button>`).join('')}</div>`;
  const header=`<div class="backpack-header">
    <div class="bph-left">
      <span class="bph-eyebrow">INVENTORY & GEAR SYSTEM</span>
      <h2>TACTICAL BACKPACK</h2>
    </div>
    <button class="backpack-close" onclick="toggleBackpack()" aria-label="Tutup Backpack">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>${tabbar}`;
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
    const mutCls=(s.mut&&s.mut!=='none')?' mut-'+s.mut:'';
    const shinyClsStr=s.shiny?' shiny':'';
    const fullMutClass=variantClass+mutCls+shinyClsStr;
    return `<div class="bp-slot filled${bpTarget===i?' sel':''}${fullMutClass}" data-sid="${s.id}" onclick="bpPickSlot(${i})" style="--tcol:${edge}${edgeStyle}"><img src="${cardImg(s.char)}" alt=""><span class="bps-num">${i+1}</span><button class="bps-x" onclick="event.stopPropagation();bpClearSlot(${i})">&times;</button></div>`;
  }).join('');
  const pOf=s=>{const st=cardStats(s.char,s.mut,s.trait,s.shiny);return st.hp+st.atk;};
  const visible=state.stacks.filter(bpMatchesMut).sort((a,b)=>(b.fav?1:0)-(a.fav?1:0)||pOf(b)-pOf(a)||luckChance(b.char,b.mut,b.shiny)-luckChance(a.char,a.mut,a.shiny)); /* favorit → terkuat → paling langka */
  const tiles=visible.map(s=>{
    const inDeck=state.deck.includes(s.id);
    const shny=s.shiny?'<span class="bpt-shiny shiny-pill">SHINY</span>':'';
    const mut=(s.mut&&s.mut!=='none')?s.mut:null;
    const trait=(s.trait&&s.trait!=='none')?s.trait:null;
    const cnt=(s.count||1)>1?`<span class="bpt-cnt">&times;${fmt(s.count)}</span>`:'';
    const stack=(shny||mut||trait)?`<div class="bpt-top">${shny}${mut?mutChip(mut,mutPill(mut,'bpt-mut')):''}${trait?traitChip(trait,`<span class="bpt-gem" style="border-color:${TRAIT_COLOR[trait]}">${traitGem(12,trait)}</span>`):''}</div>`:'';
    const edge=bpCardBorderColor(s),variant=bpCardBorderKind(s),variantClass=variant?" bp-mut-"+variant:"";
    const mutCls=mut?' mut-'+mut:'';
    const shinyClsStr=s.shiny?' shiny':'';
    const fullMutClass=variantClass+mutCls+shinyClsStr;
    return `<div class="bp-tile${inDeck?' in-deck':''}${fullMutClass}" data-sid="${s.id}" data-name="${cardName(s.char).toLowerCase()}" onclick="bpAssign('${s.id}')" style="--tcol:${edge}"><img src="${cardImg(s.char)}" alt="">${stack}${cnt}<div class="bpt-ctl"><button class="bpt-fav${s.fav?' on':''}" onclick="event.stopPropagation();bpFav('${s.id}')" title="Favorit">${s.fav?'★':'☆'}</button><button class="bpt-lock${s.lock?' on':''}" onclick="event.stopPropagation();bpLock('${s.id}')" title="Lock">${s.lock?'🔒':'🔓'}</button></div><div class="bpt-name">${cardName(s.char)}</div></div>`;
  }).join('');
  const cntOf=m=>state.stacks.filter(s=>m==='all'?true:(m==='shiny'?!!s.shiny:(s.mut||'none')===m)).length;
  const chip=(k,lbl)=>{const on=bpMutFilter===k,themed=['shiny','gold','rainbow','secret','ultima'].includes(k);const col=!on&&!themed?(MUT_COLOR[k]||'#7DF9FF'):'';return `<button class="bp-fchip${themed?' bp-themed bp-'+k:''}${on?' on':''}" onclick="bpSetFilter('${k}')"${col?` style="border-color:${col};color:${col}"`:''}>${themed?'<span class="bp-fchip-label">'+lbl+'</span>':lbl}<em>${cntOf(k)}</em></button>`;};
  const searchInput=`<input class="bp-search" type="search" placeholder="🔍 Cari kartu…" value="${deckSearch}" oninput="deckSearch=this.value;runCardSearch(this,document.querySelector('.bp-tiles'),document.getElementById('bp-nores'))">`;
  const filterRow=`<div class="bp-filter">${searchInput}${chip('all','SEMUA')+chip('shiny','SHINY')+chip('gold','GOLD')+chip('rainbow','RAINBOW')+chip('secret','SECRET')+chip('ultima','ULTIMA')}</div>`;
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
  if(kind==='potion'){const aw=activeWeatherId();return{kind,name:'WEATHER POTION',icon:'assets/images/weather-potion.webp?v=1',emoji:'🧪',cnt:state.potions||0,
    desc:'Gacha cuaca · chance asli + pity. Hasil sama/lebih bagus = pindah + timer reset 5 menit; lebih jelek = cuaca tetep.',
    active:aw?`<br><strong style="color:${WEATHER[aw].color}">Aktif: ${WEATHER[aw].icon} ${WEATHER[aw].name}</strong>`:'',use:'bpUsePotion()'};}
  if(kind.startsWith('luck')){const lv=+kind[4],d=LUCK_POTS[lv],b=activeLuckBuff(),bp=activeLuckBuffPct();return{kind,name:'LUCK POTION L'+lv,icon:`assets/images/pot-luck-${lv}.png`,emoji:'🍀',cnt:(state.luckPots&&state.luckPots[lv-1])||0,
    desc:`+${d.flat} flat luck${d.pct?` & +${Math.round(d.pct*100)}% luck`:''} selama 5 menit per pot. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.`,
    active:b||bp?`<br><strong style="color:#5eead4">Aktif: +${b} LUCK${bp?` · +${Math.round(bp*100)}%`:''}</strong>`:'',use:`bpUseLuckPotion(${lv},1)`,useAll:`bpUseLuckPotion(${lv},'all')`};}
  if(kind.startsWith('speed')){const lv=+kind.slice(-1),d=SPEED_POTS[lv],b=activeSpeedBuff();return{kind,name:'SPEED POTION L'+lv,icon:`assets/images/pot-speed-${lv}.png`,emoji:'⚡',cnt:(state.speedPots&&state.speedPots[lv-1])||0,
    desc:`Roll speed +${d.add.toFixed(1)}× selama 5 menit per pot (cap total ×20). Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.`,
    active:b?`<br><strong style="color:#fcd34d">Aktif: +${b.toFixed(1)}× SPEED</strong>`:'',use:`bpUseSpeedPotion(${lv},1)`,useAll:`bpUseSpeedPotion(${lv},'all')`};}
  if(kind==='r5k'){return{kind,name:'INSTAN ROLL 5K',icon:'assets/images/instanpack-5k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r5k)||0,
    desc:'SPECIAL ROLL PACK - Berisi 5.000 tarikan kartu instan ke dalam koleksi.',
    active:'',use:"bpUseRollPack('r5k', 5000)"};}
  if(kind==='r10k'){return{kind,name:'INSTAN ROLL 10K',icon:'assets/images/instanpack-10k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r10k)||0,
    desc:'SPECIAL ROLL PACK - Berisi 10.000 tarikan kartu instan ke dalam koleksi.',
    active:'',use:"bpUseRollPack('r10k', 10000)"};}
  if(kind==='r25k'){return{kind,name:'INSTAN ROLL 25K',icon:'assets/images/instanpack-25k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r25k)||0,
    desc:'SPECIAL ROLL PACK - Berisi 25.000 tarikan kartu instan ke dalam koleksi.',
    active:'',use:"bpUseRollPack('r25k', 25000)"};}
  if(kind==='r50k'){return{kind,name:'INSTAN ROLL 50K',icon:'assets/images/instanpack-50k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r50k)||0,
    desc:'SPECIAL ROLL PACK - Berisi 50.000 tarikan kartu instan ke dalam koleksi.',
    active:'',use:"bpUseRollPack('r50k', 50000)"};}
  if(kind==='r100k'){return{kind,name:'INSTAN ROLL 100K',icon:'assets/images/instanpack-100k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r100k)||0,
    desc:'SPECIAL ROLL PACK - Berisi 100.000 tarikan kartu instan ke dalam koleksi.',
    active:'',use:"bpUseRollPack('r100k', 100000)"};}
  if(kind==='intan'){return{kind,name:'INTAN ROLL 100K',icon:'assets/images/icon-intan.png',emoji:'💎',cnt:state.intanRolls||0,
    desc:'ITEM INDEX REWARD — didapat otomatis tiap 5 varian kartu terkumpul di Card Index (semua mutasi + varian shiny dihitung). Pakai = langsung menarik 100.000 roll kartu ke koleksi.',
    active:'',use:'bpUseIntanRoll()'};}
  return null;
}
function renderBpItems(){
  const kinds=['luck1','luck2','luck3','speed1','speed2','speed3','r5k','r10k','r25k','r50k','r100k'];
  const tiles=kinds.map(k=>{const d=bpItemDef(k);return `<div class="bp-itemtile${d.cnt>0?'':' empty'}" onclick="bpItemPop('${k}')"><div class="bp-itemtile-ic"><img src="${d.icon}" alt="${d.name}" onerror="this.parentNode.textContent='${d.emoji}'"></div><span class="bp-itemtile-cnt">×${fmt(d.cnt)}</span></div>`;}).join('');
  return `<div class="bp-h">ITEM</div><div class="bp-itemgrid">${tiles}</div>`;
}
function bpItemPop(kind){
  bpItemPopClose();
  const d=bpItemDef(kind); if(!d)return;
  const isGacha=(kind==='potion'||kind==='mythic');
  const isRollPack=kind.startsWith('r');
  const odds=isGacha?weatherOddsHTML():'';
  const multi=isGacha?`<div class="bpholo-multi-wrap"><div class="bpholo-multi-label">JUMLAH ROLL:</div><div class="wo-multi">${[1,5,25,100].map(n=>`<button data-n="${n}" class="${bpMultiN===n?'on':''}" onclick="bpSetMulti(${n})">${n}×</button>`).join('')}</div></div>`:'';
  const canUse=d.cnt>0;

  let themeTone="#7DF9FF";
  let itemCategory="TACTICAL CONSUMABLE";
  if(isRollPack){
    themeTone="#FFD700";
    itemCategory="SPECIAL ROLL PACK";
  } else if(kind.startsWith('luck')){
    themeTone="#2ed573";
    itemCategory="LUCK ENHANCER";
  } else if(kind.startsWith('speed')){
    themeTone="#ffa502";
    itemCategory="SPEED OVERCLOCK";
  } else if(isGacha){
    themeTone="#b58cff";
    itemCategory="WEATHER CATALYST";
  }

  const el=document.createElement('div'); el.id='itemPop';
  el.className='bpholo-backdrop';
  el.innerHTML=`
    <div class="bpholo-panel" style="--holo-tone:${themeTone}">
      <div class="bpholo-glow"></div>
      <button class="bpholo-x" onclick="bpItemPopClose()" type="button" title="Tutup">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <div class="bpholo-header">
        <span class="bpholo-category"><span class="bpholo-dot"></span>${itemCategory}</span>
        <h3 class="bpholo-title">${d.name}</h3>
      </div>

      <div class="bpholo-showcase">
        <div class="bpholo-pedestal"></div>
        <div class="bpholo-ic-wrap">
          <img src="${d.icon}" alt="${d.name}" class="bpholo-img" onerror="this.parentNode.textContent='${d.emoji}'">
        </div>
      </div>

      <div class="bpholo-inventory-pill">
        <span class="bpholo-inv-lbl">JUMLAH DIMILIKI:</span>
        <span class="bpholo-inv-val">×${fmt(d.cnt)}</span>
      </div>

      <div class="bpholo-info-box">
        <div class="bpholo-desc">${d.desc}</div>
        ${d.active?`<div class="bpholo-active-eff">${d.active}</div>`:''}
        ${odds}
        ${multi}
      </div>

      <div class="bpholo-actions">
        <button class="bpholo-btn-use ${canUse?'':'disabled'}" ${canUse?'':'disabled'} type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>PAKAI SEKARANG${isGacha&&bpMultiN>1?' ('+bpMultiN+'×)':''}</span>
        </button>
        ${d.useAll&&d.cnt>1?`<button class="bpholo-btn-all" onclick="${d.useAll}">GABUNG SEMUA (×${fmt(d.cnt)})</button>`:''}
        <button class="bpholo-btn-dismiss" onclick="bpItemPopClose()" type="button">TUTUP</button>
      </div>
    </div>`;

  const useBtn=el.querySelector('.bpholo-btn-use');
  if(useBtn && canUse){
    useBtn.onclick=()=>{ try{ new Function(d.use)(); }catch(err){ console.error('use err:',err); } };
  }
  el.onclick=(e)=>{if(e.target===el)bpItemPopClose();};
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
        return `<div class="wo-row"><span class="wo-ic" style="color:${w.color}">${weatherSvg(w.id,16)}</span><span class="wo-nm">${w.name}</span><span class="wo-pct">${pctS}%</span><span class="wo-inv">1 in ${invS}</span></div>`;
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
    toast(`${w?`<span style="display:inline-flex;align-items:center;gap:6px">${weatherSvg(w.id,20)} ${w.name}</span>`:'GACHA ×'+done}`,`×${done} ROLL · ${switches} PINDAH · ${kept} SKIP`,w?w.color:'#5eead4');
    if(switches)beep(520,.16,"triangle",.1),setTimeout(()=>beep(780,.18,"triangle",.1),120);
    else beep(240,.18,"sine",.07);
  }else if(last&&best===null&&kept){
    toast(`<span style="display:inline-flex;align-items:center;gap:6px">${weatherSvg(last.id,20)} ${last.name}</span>`,"ROLL LEBIH JELEK · CUACA TETEP",last.color);
    beep(240,.18,"sine",.07);
  }else{
    beep(520,.16,"triangle",.1);setTimeout(()=>beep(780,.18,"triangle",.1),120);
    toast(`<span style="display:inline-flex;align-items:center;gap:6px">${weatherSvg(best.id,20)} ${best.name}</span>`,"WEATHER AKTIF · 5 MENIT",best.color);
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
function bpUseRollPack(packKey, rollAmount){
  state.rollPacks = state.rollPacks || {};
  if((state.rollPacks[packKey]||0) < 1){toast("PACK HABIS","TIDAK ADA ITEM","#f87171");return;}
  state.rollPacks[packKey]--;
  save();
  bpItemPopClose();
  beep(520,.18,"triangle",.1);setTimeout(()=>beep(940,.24,"triangle",.08),150);
  const loot=instantRollFast(rollAmount);
  showTowerLoot(loot,{weather:0,luck:0,speed:0},'HASIL INSTAN ROLL · ' + rollAmount.toLocaleString());
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
const ST_POS={root:[50,50,0]};
function polar(tier,side){const r=18+tier*6;const ang=(side==='luck'?Math.PI*0.85:Math.PI*0.15)+(tier-1)*0.18*(side==='luck'?-1:1);const x=50+Math.cos(ang)*r;const y=24+tier*11;const z=40-tier*24;return [x,y,z];}
["lk1","lk2","lk3","lk4","lk5"].forEach((id,i)=>ST_POS[id]=polar(i+1,'luck'));
["sp1","sp2","sp3","sp4","sp5"].forEach((id,i)=>ST_POS[id]=polar(i+1,'speed'));
function stNodeHtml(n,sp){
  const isRoot=n.branch==='root';
  const owned=isRoot||treeOwned(n.id);
  const preqMet=n.req.every(r=>r==="root"||treeOwned(r));
  const affordable=sp>=n.cost;
  const st=owned?'owned':(preqMet&&affordable?'avail':(preqMet?'poor':'locked'));
  const gain=isRoot?'AKAR':(n.branch==='luck'?('+'+(Number.isInteger(n.luck)?n.luck:n.luck.toFixed(1))+' LUCK'+(n.luckPct?' · +'+Math.round(n.luckPct*100)+'%':'')):('+'+n.speed.toFixed(1)+'× SPEED'));
  const ic=BP_NODE_ICONS[n.name]||'◆';
  const [x,y,z]=ST_POS[n.id]||[50,50,0];
  const cost=isRoot?'':`<div class="st-cost">${owned?'✓':n.cost+' SP'}</div>`;
  return `<div class="st-node st-${n.branch} st-${st}" ${isRoot?'':'onclick="bpTreeBuy(\''+n.id+'\')"'} style="left:${x}%;top:${y}%;transform:translate3d(-50%,-50%,${z}px)" title="${n.name} — ${gain} · ${n.desc}">
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
function slNodeHtml(n,sp){
  const owned=treeOwned(n.id);
  const preqMet=n.req.every(r=>r==='root'||treeOwned(r));
  const affordable=sp>=n.cost;
  const st=owned?'owned':(preqMet&&affordable?'avail':(preqMet?'poor':'locked'));
  let gain,cls;
  if(n.branch==='luck'){
    gain='+'+n.luck+' LUCK'+(n.luckPct?' · +'+Math.round(n.luckPct*100)+'% mult':'');
    cls='sl-luck';
  } else if(n.branch==='speed'){
    gain='+'+n.speed.toFixed(1)+'× roll speed';
    cls='sl-speed';
  } else {
    // booster: tampilkan flat + pct sekaligus
    gain='+'+n.luck+' LUCK · +'+Math.round((n.luckPct||0)*100)+'% mult';
    cls='sl-booster';
  }
  return `<div class="sl-node ${cls} ${st}"${owned?'':` onclick="bpTreeBuy('${n.id}')"`}>
    <div class="sl-num">${n.tier}</div>
    <div class="sl-name">${n.name}</div>
    <div class="sl-gain">${gain}</div>
    <div class="sl-cost">${owned?'MILIKI':n.cost+' SP'}</div>
  </div>`;
}

function renderBpTree(){
  const sp=(state&&state.player&&state.player.sp)||0;
  const goal=TREE_NODES.filter(n=>n.id!=='root'&&!treeOwned(n.id)&&n.req.every(r=>r==='root'||treeOwned(r))).sort((a,b)=>a.cost-b.cost)[0];
  const pct=goal?Math.min(100,Math.round(sp/goal.cost*100)):100;
  const ready=!!goal&&sp>=goal.cost;
  const hint=sp>0?'beli node buat naikkan stat':'naikkan LV buat dapet SP';
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
  <div class="sl-tree">
    <div class="sl-branch sl-luck">
      <div class="sl-branch-title">☘ LUCK</div>
      ${TREE_NODES.filter(n=>n.branch==='luck').map(n=>slNodeHtml(n,sp)).join('')}
    </div>
    <div class="sl-branch sl-speed">
      <div class="sl-branch-title">⚡ SPEED</div>
      ${TREE_NODES.filter(n=>n.branch==='speed').map(n=>slNodeHtml(n,sp)).join('')}
    </div>
    <div class="sl-branch sl-booster">
      <div class="sl-branch-title">🔥 LUCK BOOSTER</div>
      <div class="sl-branch-req">Butuh lk5 &amp; sp5 terbuka</div>
      ${TREE_NODES.filter(n=>n.branch==='booster').map(n=>slNodeHtml(n,sp)).join('')}
    </div>
  </div>`;
}
function bpTreeBuy(id){
  const r=treeBuy(id);
  if(!r.ok){
    const msg=r.reason==='SP'?'SP kurang':r.reason==='PREQ'?'Buka node sebelumnya dulu':r.reason==='OWNED'?'Udah dibuka':'-';
    beep(200,.08,'square',.06);toast(msg,'GAK BISA','#f87171');return;
  }
  beep(680,.12,'triangle',.09);setTimeout(()=>beep(900,.12,'triangle',.08),90);
  let g,col;
  if(r.node.branch==='luck')    { g=r.node.luck.toFixed(1)+' LUCK'; col='#5eead4'; }
  else if(r.node.branch==='speed') { g=r.node.speed.toFixed(1)+'× SPEED'; col='#fcd34d'; }
  else { g=r.node.luck+' LUCK · +'+Math.round((r.node.luckPct||0)*100)+'% mult'; col='#f97316'; }
  toast(r.node.name,'+'+g,col);
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
  if(d.src==="premium")return `<button class="bp-shop-b buy" style="background:linear-gradient(135deg,#e6b800,#b38600);color:#0a0800;border-color:#ffd700;" onclick="openPremiumShop()">TOKO PREMIUM · ${d.gemPrice} GEMS</button>`;
  return `<button class="bp-shop-b ${(state.coins||0)>=d.price?'buy':'poor'}" onclick="bpBuy${kind}('${d.id}')">BELI · ${coinIcon(15)} ${fmt(d.price)}</button>`;
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
  return `<div class="bp-h">ARTEFAK · 2 SLOT<div class="bp-coinrow">☘ ${totalLuck().toFixed(1)}× · ${coinIcon(15)} ${fmt(coins)}</div></div>
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
  return `<div class="bp-h">PET · 1 SLOT<div class="bp-coinrow">☘ ${totalLuck().toFixed(1)}× · ${coinIcon(15)} ${fmt(coins)}</div></div>
  ${actHtml}
  <div class="bp-grid6">${cards}</div>`;
}

function bpBuyArt(id){
  const d=ART_DEFS.find(x=>x.id===id);if(!d||state.artOwned.includes(id))return;
  if(d.src&&d.src!=="coin"){toast("TIDAK DIJUAL DI SINI",d.src==="raid"?"BELI DI TOKO RAID PAKAI TOKEN":"DROP BASE DI INF TOWER","#fcd34d");return;}
  if((state.coins||0)<d.price){beep(200,.09,"square",.06);toast("COIN KURANG","BUTUH ${coinIcon(15)} "+fmt(d.price),"#f87171");return;}
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
  if(!state.battle&&typeof render==="function")render();
}
function bpArtSlot(i){const id=state.artSlots[i];if(id)bpToggleArt(id);}
function bpBuyPet(id){
  const d=PET_DEFS.find(x=>x.id===id);if(!d||state.petOwned.includes(id))return;
  if(d.src&&d.src!=="coin"){toast("TIDAK DIJUAL DI SINI",d.src==="raid"?"BELI DI TOKO RAID PAKAI TOKEN":"DROP BASE DI INF TOWER","#fcd34d");return;}
  if((state.coins||0)<d.price){beep(200,.09,"square",.06);toast("COIN KURANG","BUTUH ${coinIcon(15)} "+fmt(d.price),"#f87171");return;}
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
const MASTER_CARD_INDEX=STORY_BIBLE.units.map(u=>({char_id:u.id,name:u.name,tier:u.tier,chance:u.chance||null,type:u.type,base_hp:u.hp,base_atk:u.atk,sprite_asset:u.art,art_image:u.art,pos:u.pos||null,passive:{name:u.skill,desc:u.desc},noGacha:!!u.noGacha,weatherOnly:u.weatherOnly||null,raidBoss:!!u.raidBoss,isStoryEnemy:!!(u.noGacha&&!u.chance)}));

/* =============== PREMIUM SHOP SYSTEM =============== */
var premCurTab = 'all';

var PREMIUM_PACKS = [
  // PET & ARTEFAK
  { id: 'tome-infinity', cat: 'equip', type: 'art', name: 'TOME OF INFINITY', price: 500, img: 'assets/artifacts/tome-infinity.webp?v=1', badge: 'MYTHIC ARTIFACT', desc: 'Kitab mistis tak terbatas! Memberikan +150 Flat Luck & +200% Luck secara permanen.' },
  { id: 'cyber-kitsune', cat: 'equip', type: 'pet', name: 'CYBER KITSUNE', price: 1000, img: 'assets/pets/cyber-kitsune.webp?v=1', badge: 'SUPREME PET', desc: 'Rubah legendaris masa depan! Memberikan +250 Flat Luck & +300% Luck saat dipasang.' },

  // INSTAN ROLL PACKS
  { id: 'r5k', cat: 'pack', type: 'pack', name: 'INSTAN ROLL 5.000', amount: 5000, price: 5, img: 'assets/images/instanpack-5k.webp?v=trans1', badge: 'STARTER', desc: '5.000 tarikan kartu instan ke dalam inventori.' },
  { id: 'r10k', cat: 'pack', type: 'pack', name: 'INSTAN ROLL 10.000', amount: 10000, price: 10, img: 'assets/images/instanpack-10k.webp?v=trans1', badge: 'POPULAR', desc: '10.000 tarikan kartu instan ke dalam inventori.' },
  { id: 'r25k', cat: 'pack', type: 'pack', name: 'INSTAN ROLL 25.000', amount: 25000, price: 20, img: 'assets/images/instanpack-25k.webp?v=trans1', badge: 'VALUE', desc: '25.000 tarikan kartu instan ke dalam inventori.' },
  { id: 'r50k', cat: 'pack', type: 'pack', name: 'INSTAN ROLL 50.000', amount: 50000, price: 30, img: 'assets/images/instanpack-50k.webp?v=trans1', badge: 'EPIC', desc: '50.000 tarikan kartu instan ke dalam inventori.' },
  { id: 'r100k', cat: 'pack', type: 'pack', name: 'INSTAN ROLL 100.000', amount: 100000, price: 50, img: 'assets/images/instanpack-100k.webp?v=trans1', badge: 'ULTIMATE', desc: '100.000 tarikan kartu instan ke dalam inventori.' },

  // WEATHER INSTAN (Hanya Rare sampai Awakened)
  { id: 'w_eclipse', cat: 'weather', type: 'weather', targetWeather: 'eclipse', name: 'INSTAN ECLIPSE', price: 15, img: 'assets/images/weather-potion.webp?v=1', badge: 'RARE WEATHER', desc: 'Aktifkan cuaca ECLIPSE instan selama 30 menit! +300% Luck & +200% Roll Speed.' },
  { id: 'w_doodle', cat: 'weather', type: 'weather', targetWeather: 'doodle', name: 'INSTAN DOODLE', price: 25, img: 'assets/images/weather-potion.webp?v=1', badge: 'RARE WEATHER', desc: 'Aktifkan cuaca DOODLE instan selama 30 menit! +400% Luck & +250% Roll Speed.' },
  { id: 'w_glitch', cat: 'weather', type: 'weather', targetWeather: 'glitch', name: 'INSTAN GLITCH', price: 35, img: 'assets/images/weather-potion.webp?v=1', badge: 'RARE WEATHER', desc: 'Aktifkan cuaca GLITCH instan selama 30 menit! +500% Luck & +300% Roll Speed.' },
  { id: 'w_goofy', cat: 'weather', type: 'weather', targetWeather: 'goofy', name: 'INSTAN GOOFY', price: 50, img: 'assets/images/weather-potion.webp?v=1', badge: 'RARE WEATHER', desc: 'Aktifkan cuaca GOOFY instan selama 30 menit! +600% Luck & +350% Roll Speed.' },
  { id: 'w_arcane', cat: 'weather', type: 'weather', targetWeather: 'arcane', name: 'INSTAN ARCANE', price: 80, img: 'assets/images/weather-potion.webp?v=1', badge: 'ARCANE WEATHER', desc: 'Aktifkan anomali sihir ARCANE instan selama 30 menit! +900% Luck & +500% Roll Speed.' },
  { id: 'w_awakened', cat: 'weather', type: 'weather', targetWeather: 'awakened', name: 'INSTAN AWAKENED', price: 150, img: 'assets/images/weather-potion.webp?v=1', badge: 'SUPREME AWAKENED', desc: 'Kekuatan tertinggi semesta AWAKENED instan selama 30 menit! +1400% Luck & +700% Roll Speed.' }
];

function premSetTab(tabKey){
  premCurTab = tabKey || 'all';
  var tabs = document.querySelectorAll('.prem-tab-btn');
  tabs.forEach(function(b){
    if(b.getAttribute('data-cat') === premCurTab) b.classList.add('on');
    else b.classList.remove('on');
  });
  renderPremiumShop();
}

function openPremiumShop(){
  renderPremiumShop();
  var modal = document.getElementById('premiumModal');
  if(modal) modal.classList.add('show');
  document.body.classList.add('hide-docks-modal');
  var closeBtn = document.getElementById('premClose');
  if(closeBtn) closeBtn.onclick = closePremiumShop;
  if(modal) modal.onclick = function(e){ if(e.target.id === 'premiumModal') closePremiumShop(); };
}

function closePremiumShop(){
  var modal = document.getElementById('premiumModal');
  if(modal) modal.classList.remove('show');
  document.body.classList.remove('hide-docks-modal');
}

function renderPremiumShop(){
  var balEl = document.getElementById('premBalVal');
  if(balEl) balEl.textContent = fmt(state.premiumGems || 0);

  var grid = document.getElementById('premGrid');
  if(!grid) return;

  var filteredPacks = PREMIUM_PACKS.filter(function(p){
    if(premCurTab === 'all') return true;
    if(premCurTab === 'equip') return p.cat === 'equip';
    if(premCurTab === 'pack') return p.cat === 'pack';
    if(premCurTab === 'weather') return p.cat === 'weather';
    return true;
  });

  grid.innerHTML = filteredPacks.map(function(p){
    var isAlreadyOwned = false;
    var ownedTxt = '';
    var activeWeatherNow = activeWeatherId();

    if (p.type === 'art') {
      isAlreadyOwned = (state.artOwned || []).includes(p.id);
      ownedTxt = isAlreadyOwned ? '<span style="color:#4ade80">SUDAH DIMILIKI (ARTEFAK)</span>' : 'BELUM DIMILIKI';
    } else if (p.type === 'pet') {
      isAlreadyOwned = (state.petOwned || []).includes(p.id);
      ownedTxt = isAlreadyOwned ? '<span style="color:#4ade80">SUDAH DIMILIKI (PET)</span>' : 'BELUM DIMILIKI';
    } else if (p.type === 'weather') {
      var isCurActive = (activeWeatherNow === p.targetWeather);
      var wDef = WEATHER[p.targetWeather];
      var rem = (isCurActive && state.weather && state.weather.endsAt > Date.now()) ? fmtCountdown(state.weather.endsAt - Date.now()) : '';
      ownedTxt = isCurActive
        ? '<span style="color:' + (wDef ? wDef.color : '#38bdf8') + '">SEDANG AKTIF (⏱ ' + rem + ')</span>'
        : '<span style="color:#94a3b8">AKTIFKAN LANGSUNG 30 MENIT</span>';
    } else {
      var owned = (state.rollPacks && state.rollPacks[p.id]) || 0;
      ownedTxt = 'DIMILIKI DI BACKPACK: <b>' + owned + '</b>';
    }

    var canAfford = (state.premiumGems || 0) >= p.price;
    var btnCls = (canAfford && !isAlreadyOwned) ? 'prem-buy-btn' : 'prem-buy-btn disabled';
    var btnLabel = isAlreadyOwned ? 'SUDAH DIMILIKI' : ('BELI · ' + p.price + ' GEMS');

    var customCardBorder = '';
    if(p.type === 'weather'){
      var wCol = (WEATHER[p.targetWeather] && WEATHER[p.targetWeather].color) || '#38bdf8';
      customCardBorder = ' style="border-color:' + wCol + '55"';
    }

    return '<div class="prem-card' + (isAlreadyOwned ? ' prem-card-owned-full' : '') + '"' + customCardBorder + '>' +
      '<div class="prem-card-badge">' + p.badge + '</div>' +
      '<div class="prem-card-img-wrap">' +
        (p.type === 'weather'
          ? '<div style="position:relative;width:100%;height:100%;display:grid;place-items:center;background:radial-gradient(circle,' + (WEATHER[p.targetWeather]?.color || '#38bdf8') + '22,transparent 70%)"><img src="' + p.img + '" alt="' + p.name + '" class="prem-card-img" style="width:70px;height:70px"><span style="position:absolute;bottom:6px;right:10px;font-size:24px;filter:drop-shadow(0 0 8px currentColor)">' + (WEATHER[p.targetWeather]?.icon || '✨') + '</span></div>'
          : '<img src="' + p.img + '" alt="' + p.name + '" class="prem-card-img">') +
      '</div>' +
      '<div class="prem-card-info">' +
        '<div class="prem-card-name">' + p.name + '</div>' +
        '<div class="prem-card-desc">' + p.desc + '</div>' +
        '<div class="prem-card-owned">' + ownedTxt + '</div>' +
      '</div>' +
      '<div class="prem-card-footer">' +
        '<button class="' + btnCls + '" type="button" ' + (isAlreadyOwned ? 'disabled' : '') + ' onclick="buyPremiumPack(\'' + p.id + '\', event)">' +
          '<img src="assets/images/premium-currency.webp?v=trans1" alt="Gem" width="18" height="18">' +
          '<span>' + btnLabel + '</span>' +
        '</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function buyPremiumPack(packId, ev){
  var pack = PREMIUM_PACKS.find(function(x){ return x.id === packId; });
  if(!pack) return;

  // Cek jika sudah memiliki artefak/pet unik
  if(pack.type === 'art' && (state.artOwned || []).includes(pack.id)){
    toast('SUDAH PUNYA', 'Artefak ' + pack.name + ' sudah ada di Backpack!', '#fcd34d');
    return;
  }
  if(pack.type === 'pet' && (state.petOwned || []).includes(pack.id)){
    toast('SUDAH PUNYA', 'Pet ' + pack.name + ' sudah ada di Backpack!', '#fcd34d');
    return;
  }

  var btn = (ev && ev.currentTarget) || (window.event && window.event.currentTarget);
  if(btn) { btn.disabled = true; btn.textContent = 'MEMPROSES...'; }
  console.log('[BUY PREMIUM] Starting purchase:', packId, 'type:', pack.type, 'price:', pack.price);

  try {
    if(window.CloudDB && typeof window.CloudDB.verifyAndDeductGems === 'function'){
      var res = await window.CloudDB.verifyAndDeductGems(currentUser, pack.price, pack.id, pack.type);
      if(!res.ok){
        beep(280,.2,'sawtooth',.12);
        toast('TRANSAKSI GAGAL', res.msg || 'Saldo tidak mencukupi!', '#f87171');
        renderPremiumShop();
        renderShell();
        return;
      }
      state.premiumGems = (typeof res.balance === 'number') ? res.balance : (state.premiumGems - pack.price);
      if(pack.type === 'art'){
        state.artOwned = state.artOwned || [];
        if(!state.artOwned.includes(pack.id)) state.artOwned.push(pack.id);
      } else if(pack.type === 'pet'){
        state.petOwned = state.petOwned || [];
        if(!state.petOwned.includes(pack.id)) state.petOwned.push(pack.id);
      } else if(pack.type === 'weather'){
        const wId = pack.targetWeather;
        state.weatherBest = betterWeather(state.weatherBest, wId);
        state.weather = { id: wId, endsAt: Date.now() + WEATHER_ROTATE_MS };
      } else {
        state.rollPacks = state.rollPacks || {};
        state.rollPacks[pack.id] = (state.rollPacks[pack.id] || 0) + 1;
      }
      save();
    } else {
      if((state.premiumGems || 0) < pack.price){
        beep(280,.2,'sawtooth',.12);
        toast('GEMS KURANG', 'Butuh ' + pack.price + ' Gems untuk beli ini!', '#f87171');
        return;
      }
      state.premiumGems -= pack.price;
      if(pack.type === 'art'){
        state.artOwned = state.artOwned || [];
        if(!state.artOwned.includes(pack.id)) state.artOwned.push(pack.id);
      } else if(pack.type === 'pet'){
        state.petOwned = state.petOwned || [];
        if(!state.petOwned.includes(pack.id)) state.petOwned.push(pack.id);
      } else if(pack.type === 'weather'){
        const wId = pack.targetWeather;
        state.weatherBest = betterWeather(state.weatherBest, wId);
        state.weather = { id: wId, endsAt: Date.now() + WEATHER_ROTATE_MS };
      } else {
        state.rollPacks = state.rollPacks || {};
        state.rollPacks[pack.id] = (state.rollPacks[pack.id] || 0) + 1;
      }
      save();
    }

    beep(640,.15,'triangle',.08);
    setTimeout(function(){ beep(960,.2,'triangle',.09); }, 120);

    var rewardMsg = '';
    if(pack.type === 'art' || pack.type === 'pet'){
      rewardMsg = '+' + pack.name + ' berhasil dibuka & masuk Backpack!';
    } else if(pack.type === 'weather'){
      const wDef = WEATHER[pack.targetWeather] || {};
      rewardMsg = 'Cuaca ' + (wDef.name || pack.name) + ' AKTIF selama 30 menit!';
    } else {
      rewardMsg = '+1 ' + pack.name + ' masuk ke Backpack!';
    }

    toast('PEMBELIAN BERHASIL!', rewardMsg, pack.type === 'weather' ? (WEATHER[pack.targetWeather]?.color || '#FFD700') : '#FFD700');
    save();
    renderPremiumShop();
    renderShell();
    if(typeof renderWeatherDock === 'function') renderWeatherDock();
    if(typeof renderBackpackPanel === 'function') renderBackpackPanel();
    if(typeof renderWeatherMachine === 'function' && document.getElementById('weatherMachineModal')?.classList.contains('show')) {
      renderWeatherMachine();
    }
    console.log('[BUY PREMIUM] Success! state.premiumGems:', state.premiumGems);
  } catch(err){
    console.error('Buy pack error:', err);
    toast('ERROR', 'Terjadi kesalahan saat transaksi', '#f87171');
  } finally {
    if(btn) btn.disabled = false;
  }
}

window.openPremiumShop = openPremiumShop;
window.closePremiumShop = closePremiumShop;
window.buyPremiumPack = buyPremiumPack;
window.premSetTab = premSetTab;



/* =============== WEATHER MACHINE SYSTEM (TRAIT-STYLE CYBER MATRIX) =============== */
let wmMultiN = 1;
let wmAutoTarget = null;
let wmAutoRunning = false;
let wmAutoTimer = null;
let wmAutoCount = 0;
let wmRenderTimer = null;

function openWeatherMachine(){
  wmAutoRunning = false;
  if(wmAutoTimer) clearTimeout(wmAutoTimer);
  renderWeatherMachine();
  wmRenderTimer = setInterval(renderWeatherMachine, 1000);
  const modal = document.getElementById('weatherMachineModal');
  if(modal) modal.classList.add('show');
  document.body.classList.add('hide-docks-modal');
  const closeBtn = document.getElementById('wmClose');
  if(closeBtn) closeBtn.onclick = closeWeatherMachine;
  if(modal) modal.onclick = function(e){ if(e.target.id === 'weatherMachineModal') closeWeatherMachine(); };
}

function closeWeatherMachine(){
  if(wmRenderTimer){clearInterval(wmRenderTimer);wmRenderTimer=null;}
  wmStopAuto();
  const modal = document.getElementById('weatherMachineModal');
  if(modal) modal.classList.remove('show');
  document.body.classList.remove('hide-docks-modal');
}

function setWmMulti(n){
  wmMultiN = n;
  renderWeatherMachine();
}

function wmSynthesizeRoll(multi){
  const n = multi || wmMultiN || 1;
  let done = 0, switches = 0, kept = 0, best = null, last = null;
  
  for(let i = 0; i < n; i++){
    const r = useWeatherPotion();
    if(!r.ok) break;
    done++;
    last = r.weather;
    if(r.kept) kept++;
    else {
      switches++;
      if(!best || r.weather.dropWeight < best.dropWeight) best = r.weather;
    }
  }

  if(!done){
    toast("POTION HABIS", "Tidak ada Weather Potion tersisa!", "#f87171");
    beep(240, 0.12, 'square', 0.08);
    wmStopAuto();
    renderWeatherMachine();
    return false;
  }

  if(n > 1){
    const w = best || last;
    toast(done + "× SINTESIS CUACA", switches ? ("Anomali aktif: " + w.name + " (" + switches + "× pergeseran)") : ("Cuaca stabil (" + kept + "× hasil sama/rendah)"), w.color);
  } else {
    toast(last.name, last.desc, last.color);
  }

  beep(520, 0.1, "triangle", 0.08);
  setTimeout(() => beep(780, 0.15, "triangle", 0.09), 80);

  save();
  renderWeatherMachine();
  renderShell();
  if(!state.battle && typeof render === "function") render();
  return true;
}

function wmToggleAuto(){
  if(wmAutoRunning){
    wmStopAuto();
  } else {
    if(!wmAutoTarget){
      toast("PILIH TARGET", "Centang target cuaca pada daftar di sebelah kanan terlebih dahulu!", "#fcd34d");
      beep(240, 0.12, 'square', 0.08);
      return;
    }
    if((state.potions || 0) < 1){
      toast("POTION HABIS", "Dibutuhkan Weather Potion untuk memulai auto-synthesis!", "#f87171");
      return;
    }
    wmAutoRunning = true;
    wmAutoCount = 0;
    renderWeatherMachine();
    wmAutoLoop();
  }
}

function wmStopAuto(){
  wmAutoRunning = false;
  if(wmAutoTimer) clearTimeout(wmAutoTimer);
  renderWeatherMachine();
}

/* wmAutoPaint: update ringan saat auto-loop — tidak re-render seluruh shell/app */
function wmAutoPaint(){
  const aw = activeWeatherId();
  const curDef = (aw && WEATHER[aw]) || WEATHER.sunshine;
  const pPotCnt = (state && state.potions) || 0;
  const remainingTime = (state && state.weather && state.weather.endsAt && state.weather.endsAt > Date.now())
    ? fmtCountdown(state.weather.endsAt - Date.now())
    : '00:00';

  // update header: cuaca aktif + timer + stok potion
  const headEl = document.getElementById('wmHeadWeather');
  if(headEl){
    headEl.innerHTML = '' +
      '<div class="wm-head-pill wm-cur-badge" style="border-color:' + curDef.color + ';box-shadow:0 0 10px ' + curDef.color + '33">' +
        '<span class="wm-cur-ic" style="color:' + curDef.color + '">' + curDef.icon + '</span>' +
        '<strong style="color:' + curDef.color + '">' + curDef.name + '</strong>' +
        '<span class="wm-cur-timer">⏱ ' + remainingTime + '</span>' +
      '</div>' +
      '<div class="wm-head-pill wm-supply-badge" title="Stok Weather Potion">' +
        '<img src="assets/images/weather-potion.webp?v=1" alt="Potion" class="wm-head-pot-img">' +
        '<span class="wm-pot-sep">:</span>' +
        '<b class="wm-pot-val">' + fmt(pPotCnt) + '</b>' +
      '</div>';
  }

  // update iterasi counter
  const iterEl = document.querySelector('.tram-n');
  if(iterEl) iterEl.textContent = '#' + wmAutoCount;

  // update cuaca aktif di rates list (ACTIVE flag)
  document.querySelectorAll('.wm-rates-list .trr-item').forEach(it => {
    const wid = it.querySelector('input[name="wmAutoTgt"]')?.value;
    const own = !!wid && wid === aw;
    it.classList.toggle('own', own);
    const row = it.querySelector('.trr-row');
    if(!row) return;
    const old = row.querySelector('.trr-flag');
    if(old) old.remove();
    if(own){
      const flag = document.createElement('span');
      flag.className = 'trr-flag';
      flag.textContent = 'ACTIVE';
      const rar = row.querySelector('.trr-rar');
      if(rar) row.insertBefore(flag, rar); else row.appendChild(flag);
    }
  });

  // update pity bars
  const p = (state && state.wpity) || { r: 0, m: 0 };
  const rLeft = Math.max(0, PITY_RARE - (p.r || 0));
  const mLeft = Math.max(0, PITY_MYTHIC - (p.m || 0));
  const pityBlocks = document.querySelectorAll('.wo-pity');
  if(pityBlocks[0]){
    const top = pityBlocks[0].querySelector('.wo-pity-top b');
    if(top) top.textContent = fmt(rLeft) + ' SINTESIS';
    const bar = pityBlocks[0].querySelector('.wo-bar i');
    if(bar) bar.style.width = Math.min(100, (PITY_RARE - rLeft) / PITY_RARE * 100).toFixed(1) + '%';
  }
  if(pityBlocks[1]){
    const top = pityBlocks[1].querySelector('.wo-pity-top b');
    if(top) top.textContent = fmt(mLeft) + ' SINTESIS';
    const bar = pityBlocks[1].querySelector('.wo-bar i');
    if(bar) bar.style.width = Math.min(100, (PITY_MYTHIC - mLeft) / PITY_MYTHIC * 100).toFixed(1) + '%';
  }

  // update cuaca panel kiri (nama, warna, timer, stat)
  const curPanel = document.querySelector('.wm-cur-panel');
  if(curPanel){
    curPanel.style.setProperty('--tcol', curDef.color);
    const tcName = curPanel.querySelector('.tc-name');
    if(tcName){ tcName.style.color = curDef.color; tcName.textContent = curDef.name; }
    const durBadge = curPanel.querySelectorAll('.tc-badge-stat .tcb-val')[2];
    if(durBadge) durBadge.textContent = remainingTime;
  }

  // update coin di shell tanpa re-render
  const cv = document.getElementById('coinVal'); if(cv) cv.textContent = fmt(state.coins);
  const c = document.getElementById('trCoinVal'); if(c) c.textContent = fmt(state.coins);
}

function wmAutoLoop(){
  if(!wmAutoRunning) return;
  if((state.potions || 0) < 1){
    toast("AUTO SELESAI", "Weather Potion habis!", "#f87171");
    wmStopAuto();
    return;
  }

  wmAutoCount++;
  const r = useWeatherPotion();
  if(!r.ok){
    wmStopAuto();
    return;
  }

  save();
  wmAutoPaint(); // ← update surgical, tanpa renderShell/render

  // Cek apakah mencapai target cuaca
  const cur = activeWeatherId();
  if(cur && cur === wmAutoTarget){
    beep(720, 0.2, "triangle", 0.1);
    setTimeout(() => beep(960, 0.25, "triangle", 0.12), 120);
    toast("TARGET TERCAPAI!", "Cuaca " + WEATHER[cur].name + " berhasil diaktifkan pada iterasi #" + wmAutoCount, WEATHER[cur].color);
    wmStopAuto();
    renderWeatherMachine(); // full render sekali saat selesai
    if(!state.battle && typeof render === "function") render();
    renderShell();
    return;
  }

  wmAutoTimer = setTimeout(wmAutoLoop, 140);
}

function renderWeatherMachine(){
  const bodyEl = document.getElementById('wmBody');
  const headEl = document.getElementById('wmHeadWeather');
  if(!bodyEl) return;

  const aw = activeWeatherId();
  const curDef = (aw && WEATHER[aw]) || WEATHER.sunshine;
  const remainingTime = (state && state.weather && state.weather.endsAt && state.weather.endsAt > Date.now())
    ? fmtCountdown(state.weather.endsAt - Date.now())
    : '00:00';
  const pPotCnt = (state && state.potions) || 0;

  if(headEl){
    headEl.innerHTML = '' +
      '<div class="wm-head-pill wm-cur-badge" style="border-color:' + curDef.color + ';box-shadow:0 0 10px ' + curDef.color + '33">' +
        '<span class="wm-cur-ic" style="color:' + curDef.color + '">' + curDef.icon + '</span>' +
        '<strong style="color:' + curDef.color + '">' + curDef.name + '</strong>' +
        '<span class="wm-cur-timer">⏱ ' + remainingTime + '</span>' +
      '</div>' +
      '<div class="wm-head-pill wm-supply-badge" title="Stok Weather Potion">' +
        '<img src="assets/images/weather-potion.webp?v=1" alt="Potion" class="wm-head-pot-img">' +
        '<span class="wm-pot-sep">:</span>' +
        '<b class="wm-pot-val">' + fmt(pPotCnt) + '</b>' +
      '</div>';
  }

  const p = (state && state.wpity) || { r: 0, m: 0 };
  const rLeft = Math.max(0, PITY_RARE - (p.r || 0));
  const mLeft = Math.max(0, PITY_MYTHIC - (p.m || 0));

  // Daftar probabilitas cuaca (seperti tr-rates)
  const ratesHtml = WEATHERS.map(w => {
    const own = aw === w.id;
    const isTarget = wmAutoTarget === w.id;
    const pct = w.dropWeight / 100;
    const pctS = pct < 1 ? pct.toFixed(2) : pct.toFixed(1);
    const inv = Math.round(10000 / w.dropWeight);
    return '<div class="trr-item' + (own ? ' own' : '') + (isTarget ? ' is-target' : '') + '" style="--tcol:' + w.color + '" title="' + w.name + ' • ' + w.desc + '">' +
      '<div class="trr-row">' +
        '<span class="trr-gem" style="color:' + w.color + '">' + w.icon + '</span>' +
        '<span class="trr-name" style="color:' + w.color + '">' + w.name + '</span>' +
        (own ? '<span class="trr-flag">ACTIVE</span>' : '') +
        '<span class="trr-rar ' + w.rar.toLowerCase() + '">' + w.rar + '</span>' +
        '<span class="trr-pct">' + pctS + '%</span>' +
        '<label class="trr-tgt" title="Target Auto Synthesis">' +
          '<input type="radio" name="wmAutoTgt" value="' + w.id + '" ' + (isTarget ? 'checked' : '') + ' onchange="wmSelectTarget(\'' + w.id + '\')">' +
          '<span class="trr-tgt-box">' +
            '<svg class="trr-tgt-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
          '</span>' +
        '</label>' +
      '</div>' +
      '<div class="trr-bar"><i style="width:' + Math.min(100, Math.max(2, (w.dropWeight / 4500) * 100)) + '%;background:linear-gradient(90deg,' + w.color + ',#7DF9FF)"></i></div>' +
    '</div>';
  }).join('');

  bodyEl.innerHTML = '' +
    '<div class="tr-grid wm-grid">' +
      '<!-- SISI KIRI: CONTROLS & SYNTHESIZER (SEPERTI TR-MAIN) -->' +
      '<div class="tr-main wm-main">' +
        '<!-- KARTU AKTIF CUACA (MIRIP TR-CUR) -->' +
        '<div class="tr-cur wm-cur-panel" style="--tcol:' + curDef.color + '">' +
          '<div class="tr-cur-thumb-wrap wm-thumb-wrap">' +
            '<img src="assets/images/weather-potion.webp?v=1" alt="Weather Potion">' +
            '<span class="tr-cur-scanline"></span>' +
          '</div>' +
          '<div class="tr-cur-info wm-cur-info">' +
            '<div class="tc-lbl-row">' +
              '<span class="tc-lbl">ATMOSPHERIC NODE</span>' +
              '<span class="tc-code">CORE // ' + curDef.rar + '</span>' +
            '</div>' +
            '<div class="tc-name" style="color:' + curDef.color + '">' + curDef.name + '</div>' +
            '<div class="tc-tline">' +
              '<span class="tc-trait-pill" style="--tcol:' + curDef.color + '">' +
                '<span class="tc-gem-wrap">' + curDef.icon + '</span>' +
                '<span class="tc-name-glow">' + curDef.desc + '</span>' +
              '</span>' +
            '</div>' +
            '<div class="tc-tstat-wrap wm-stat-row">' +
              '<div class="tc-badge-stat"><span class="tcb-tag">LUCK</span> <b class="tcb-val">' + (curDef.luckBonus > 1 ? '+' + Math.round((curDef.luckBonus - 1) * 100) + '%' : '1.0×') + '</b></div>' +
              '<div class="tc-badge-stat"><span class="tcb-tag">SPEED</span> <b class="tcb-val">' + (curDef.speedBonus > 1 ? '+' + Math.round((curDef.speedBonus - 1) * 100) + '%' : '1.0×') + '</b></div>' +
              '<div class="tc-badge-stat"><span class="tcb-tag">DURATION</span> <b class="tcb-val">' + remainingTime + '</b></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<!-- PITY BARS -->' +
        '<div class="wm-pity-block">' +
          '<div class="wo-pity">' +
            '<div class="wo-pity-top"><span>RARE GUARANTEED IN</span><b>' + fmt(rLeft) + ' SINTESIS</b></div>' +
            '<div class="wo-bar wo-r"><i style="width:' + Math.min(100, (PITY_RARE - rLeft) / PITY_RARE * 100).toFixed(1) + '%"></i></div>' +
          '</div>' +
          '<div class="wo-pity">' +
            '<div class="wo-pity-top"><span>AWAKENED GUARANTEED IN</span><b>' + fmt(mLeft) + ' SINTESIS</b></div>' +
            '<div class="wo-bar wo-m"><i style="width:' + Math.min(100, (PITY_MYTHIC - mLeft) / PITY_MYTHIC * 100).toFixed(1) + '%"></i></div>' +
          '</div>' +
        '</div>' +

        '<!-- TOMBOL KONTROL SYNTHESIS (SEPERTI TR-CONTROLS) -->' +
        '<div class="tr-controls wm-controls">' +
          '<button class="tr-btn tr-roll wm-roll-btn" type="button" ' + (pPotCnt < 1 || wmAutoRunning ? 'disabled' : '') + ' onclick="wmSynthesizeRoll()">' +
            '<span class="tr-btn-glow"></span>' +
            '<span class="tr-btn-content">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>' +
              '<span>' + (wmAutoRunning ? 'SYNTHESIS RUNNING...' : 'SINTESIS CUACA') + '</span>' +
              '<span class="tr-cost-badge">1× POTION</span>' +
            '</span>' +
          '</button>' +
        '</div>' +

        '<!-- AUTO SYNTHESIS PANEL (SEPERTI TR-AUTO-PANEL) -->' +
        '<div class="tr-auto-panel' + (wmAutoRunning ? ' on' : '') + '">' +
          '<div class="tr-auto-top">' +
            '<button class="tr-btn tr-auto-btn wm-auto-btn" type="button" ' + (pPotCnt < 1 && !wmAutoRunning ? 'disabled' : '') + ' onclick="wmToggleAuto()">' +
              (wmAutoRunning
                ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> ABORT AUTO SYNTHESIS'
                : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg> INITIATE AUTO SYNTHESIS') +
            '</button>' +
            '<div class="tr-pulse-indicator' + (wmAutoRunning ? ' pulse-run' : '') + '">' +
              '<span class="tr-pi-dot"></span>' +
              '<span class="tr-pi-txt">' + (wmAutoRunning ? 'CYCLING 140ms' : 'STANDBY') + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="tr-auto-meta">' +
            '<div class="tram-row"><span class="tram-k">LOCKED TARGET:</span> <b class="tram-v">' + (wmAutoTarget ? WEATHER[wmAutoTarget].name : 'PILIH DARI DAFTAR') + '</b></div>' +
            '<div class="tram-row"><span class="tram-k">ITERATION:</span> <b class="tram-n">#' + wmAutoCount + '</b></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<!-- SISI KANAN: RATES & TARGET SELECTOR (SEPERTI TR-RATES) -->' +
      '<div class="tr-rates wm-rates">' +
        '<div class="trr-h">' +
          '<div class="trr-h-title">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' +
            'ATMOSPHERIC PROBABILITY MATRIX' +
          '</div>' +
          '<span class="trr-h-sub">PILIH TARGET AUTO</span>' +
        '</div>' +
        '<div class="trr-list wm-rates-list">' + ratesHtml + '</div>' +
      '</div>' +
    '</div>';
}

function wmSelectTarget(wId){
  wmAutoTarget = (wmAutoTarget === wId) ? null : wId;
  renderWeatherMachine();
}

window.openWeatherMachine = openWeatherMachine;
window.closeWeatherMachine = closeWeatherMachine;
window.setWmMulti = setWmMulti;
window.wmSynthesizeRoll = wmSynthesizeRoll;
window.wmToggleAuto = wmToggleAuto;
window.wmSelectTarget = wmSelectTarget;
window.renderWeatherMachine = renderWeatherMachine;
