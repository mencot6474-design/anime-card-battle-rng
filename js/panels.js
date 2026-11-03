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
  {id:"awakened",   name:"AWAKENED",   icon:"𓂀",  dropWeight:1,   rar:"AWAKENED", luckBonus:15.0, speedBonus:8.0, color:"#c084fc"},
  {id:"arcane",     name:"ARCANE",     icon:"꩜",  dropWeight:5,   rar:"ARCANE",   luckBonus:10.0, speedBonus:6.0, color:"#a78bfa"},
  {id:"goofy",      name:"GOOFY",      icon:"⍟",  dropWeight:15,  rar:"RARE",     luckBonus:7.0,  speedBonus:4.5, color:"#fde047"},
  {id:"glitch",     name:"GLITCH",     icon:"⌗",  dropWeight:20,  rar:"RARE",     luckBonus:6.0,  speedBonus:4.0, color:"#f87171"},
  {id:"doodle",     name:"DOODLE",     icon:"⌘",  dropWeight:25,  rar:"RARE",     luckBonus:5.0,  speedBonus:3.5, color:"#f1f5f9"},
  {id:"eclipse",    name:"ECLIPSE",    icon:"𐌈",  dropWeight:40,  rar:"RARE",     luckBonus:4.0,  speedBonus:3.0, color:"#c4b5fd"},
  /* UNCOMMON */
  {id:"iceage",     name:"ICE AGE",    icon:"⟁",  dropWeight:67,  rar:"UNCOMMON", luckBonus:3.5,  speedBonus:3.0, color:"#67e8f9"},
  {id:"galactic",   name:"GALACTIC",   icon:"⊛",  dropWeight:100, rar:"UNCOMMON", luckBonus:3.0,  speedBonus:2.5, color:"#fb923c"},
  {id:"aurora",     name:"AURORA",     icon:"⌬",  dropWeight:143, rar:"UNCOMMON", luckBonus:2.5,  speedBonus:2.0, color:"#5eead4"},
  {id:"monsoon",    name:"MONSOON",    icon:"⍦",  dropWeight:333, rar:"UNCOMMON", luckBonus:2.0,  speedBonus:1.8, color:"#60a5fa"},
  /* COMMON */
  {id:"sandstorm",  name:"SANDSTORM",  icon:"⟳",  dropWeight:1000,rar:"COMMON",   luckBonus:1.3,  speedBonus:1.4, color:"#fbbf24"},
  {id:"thunderstorm",name:"THUNDERSTORM",icon:"⌁", dropWeight:1000,rar:"COMMON",   luckBonus:1.4,  speedBonus:1.5, color:"#fde047"},
  {id:"snowfall",   name:"SNOWFALL",   icon:"⁕",  dropWeight:1400,rar:"COMMON",   luckBonus:1.25, speedBonus:1.3, color:"#bae6fd"},
  {id:"lightrain",  name:"LIGHT RAIN", icon:"⁑",  dropWeight:2340,rar:"COMMON",   luckBonus:1.2,  speedBonus:1.2, color:"#7dd3fc"},
  {id:"windy",      name:"WINDY",      icon:"≋",  dropWeight:3511,rar:"COMMON",   luckBonus:1.1,  speedBonus:1.1, color:"#86efac"},
];
const WEATHER=Object.fromEntries(WEATHERS.map(w=>[w.id,w]));
/* Fallback saat belum ada cuaca aktif (dulu referensi weather default tidak ada -> crash) */
const WM_NO_WEATHER=WEATHER.windy;

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
    case "sunny":
    case "clear":
      return `<svg class="w-svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
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
  {id:"lk1",   branch:"luck", tier:1,name:"LUCK 1",          cost:1,luck:5,   speed:0,  req:["root"],                desc:"Mata mulai tajam cari yang langka."},
  {id:"lk2",   branch:"luck", tier:2,name:"LUCK 2",      cost:3,luck:10,  speed:0,  req:["lk1"],                 desc:"Peluang kartu bagus naik."},
  {id:"lk3",   branch:"luck", tier:3,name:"LUCK 3",       cost:5,luck:15,  speed:0,  req:["lk2"],                 desc:"Rezeki mulai ngalir."},
  {id:"lk4",   branch:"luck", tier:4,name:"LUCK 4",       cost:10,luck:20, speed:0,  req:["lk3"],                 desc:"Tuaian hoki melimpah."},
  {id:"lk5",   branch:"luck", tier:5,name:"LUCK 5",  cost:15,luck:25, luckPct:0.1, speed:0, req:["lk4"],      desc:"Semua aliran hoki bermuara ke lo. +10% pengali luck."},
  {id:"sp1",   branch:"speed",tier:1,name:"SPEED 1",        cost:1,luck:0,   speed:0.4,req:["root"],                desc:"Roll mulai ngebut."},
  {id:"sp2",   branch:"speed",tier:2,name:"SPEED 2",         cost:3,luck:0,   speed:0.6,req:["sp1"],                 desc:"Jeda antar-roll mengecil."},
  {id:"sp3",   branch:"speed",tier:3,name:"SPEED 3",         cost:5,luck:0,   speed:0.8,req:["sp2"],                 desc:"Sambaran roll super cepat."},
  {id:"sp4",   branch:"speed",tier:4,name:"SPEED 4",         cost:10,luck:0,  speed:1.0,req:["sp3"],                 desc:"Nyaris gak kerasa nunggu."},
  {id:"sp5",   branch:"speed",tier:5,name:"SPEED 5",        cost:15,luck:0,  speed:1.2,req:["sp4"],                desc:"Mentok jalur speed pohon (kumulatif 5.0×) — total roll speed bisa lebih tinggi +potion/cuaca."},
  /* ===== LUCK BOOSTER (panel ketiga, butuh lk5 & sp5 terbuka dulu) ===== */
  {id:"bst1",  branch:"booster",tier:1,name:"BOOSTER 1",   cost:10,luck:50, luckPct:0.25,speed:0, req:["lk5","sp5"], desc:"Booster pertama — daya luck meledak. +50 flat · +25% pengali."},
  {id:"bst2",  branch:"booster",tier:2,name:"BOOSTER 2",  cost:10,luck:50, luckPct:0.25,speed:0, req:["bst1"],      desc:"Gelombang kedua amplifikasi luck. +50 flat · +25% pengali."},
  {id:"bst3",  branch:"booster",tier:3,name:"BOOSTER 3", cost:10,luck:50, luckPct:0.25,speed:0, req:["bst2"],      desc:"Tiga lapis resonansi luck. +50 flat · +25% pengali."},
  {id:"bst4",  branch:"booster",tier:4,name:"BOOSTER 4",  cost:10,luck:50, luckPct:0.25,speed:0, req:["bst3"],      desc:"Hampir puncak — luck mendidih. +50 flat · +25% pengali."},
  {id:"bst5",  branch:"booster",tier:5,name:"BOOSTER 5",    cost:20,luck:100,luckPct:0.50,speed:0, req:["bst4"],      desc:"Puncak pohon booster — luck menembus batas. +100 flat · +50% pengali."},
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
  if(typeof l12UpdateWeatherDock === 'function') l12UpdateWeatherDock(true);
  if(typeof renderWeatherDock === 'function') renderWeatherDock();
  return {ok:true,kept:r.kept,weather:r.weather};
}
/* Mythic Weather Potion: aturan gacha sama, tapi AWAKENED chance 3%. */
function useMythicWeatherPotion(){
  if(!state||(state.mythicPotions||0)<1)return {ok:false,reason:"NO_POTION"};
  state.mythicPotions--;
  const r=applyPotionRoll(potionWeatherRoll({boostAwakened:true}));
  save();
  if(typeof l12UpdateWeatherDock === 'function') l12UpdateWeatherDock(true);
  if(typeof renderWeatherDock === 'function') renderWeatherDock();
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
function luckBuffs(){if(!state||!Array.isArray(state.luckBuffs))return[];const now=Date.now();state.luckBuffs=state.luckBuffs.filter(b=>b&&b.endsAt>now);return state.luckBuffs.slice();}
function speedBuffs(){if(!state||!Array.isArray(state.speedBuffs))return[];const now=Date.now();state.speedBuffs=state.speedBuffs.filter(b=>b&&b.endsAt>now);return state.speedBuffs.slice();}
function useLuckPotion(lv,n){
  lv=Math.max(1,Math.min(3,lv|0));n=Math.max(1,n|0);
  const def=LUCK_POTS[lv];
  if(!state||!def)return{ok:false,reason:"NO_POTION"};
  if(!Array.isArray(state.luckPots))state.luckPots=[0,0,0];
  if((state.luckPots[lv-1]||0)<n)return{ok:false,reason:"NO_POTION"};
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
  if(!state||!def)return{ok:false,reason:"NO_POTION"};
  if(!Array.isArray(state.speedPots))state.speedPots=[0,0,0];
  if((state.speedPots[lv-1]||0)<n)return{ok:false,reason:"NO_POTION"};
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

/* ==========================================================================
   LOBBY v12 HELPER: QUICK POTION & WEATHER CARDS
   ========================================================================== */
window.l12GetPotionSummary = function(type){
  if(!state) return { stocks: [0,0,0], totalStock: 0, activeBuffs: [], topBuff: null };
  const isLuck = type === 'luck';
  const rawStocks = isLuck ? (state.luckPots || [0,0,0]) : (state.speedPots || [0,0,0]);
  const stocks = [Number(rawStocks[0])||0, Number(rawStocks[1])||0, Number(rawStocks[2])||0];
  const totalStock = stocks[0] + stocks[1] + stocks[2];
  const activeBuffs = isLuck ? (typeof luckBuffs === 'function' ? luckBuffs() : []) : (typeof speedBuffs === 'function' ? speedBuffs() : []);
  let topBuff = null;
  if(activeBuffs && activeBuffs.length){
    topBuff = activeBuffs.slice().sort((a,b)=>(b.lv||0)-(a.lv||0))[0];
  }
  return { stocks, totalStock, activeBuffs, topBuff };
};

window.l12UsePotionQuick = function(type, lv){
  lv = Math.max(1, Math.min(3, parseInt(lv, 10) || 1));
  const isLuck = type === 'luck';
  const r = isLuck ? useLuckPotion(lv, 1) : useSpeedPotion(lv, 1);
  if(r && r.ok){
    if(typeof beep === "function") beep(560, 0.12, "triangle", 0.09);
    const pName = isLuck ? "LUCK POTION L" + lv : "SPEED POTION L" + lv;
    const pDetail = isLuck ? ("+" + (r.flat||0) + " FLAT" + (r.pct ? " & +" + Math.round(r.pct*100) + "%" : "") + " (+5 MENIT)") : ("+" + (r.add||0).toFixed(1) + "x SPEED (+5 MENIT)");
    if(typeof toast === "function") toast(pName + " DIAKTIFKAN", pDetail, "#38bdf8");
    if(typeof renderBuffDock === "function") renderBuffDock();
    if(typeof renderShell === "function") renderShell();
    return r;
  } else {
    if(typeof beep === "function") beep(240, 0.12, "square", 0.08);
    if(typeof toast === "function") toast("STOK POTION HABIS", "Beli atau dapatkan Potion di Infinite Shop / Raid Shop / Tower!", "#f87171");
    return r || { ok: false, reason: "NO_POTION" };
  }
};

window.l12GetWeatherCards = function(weatherId){
  if(typeof MASTER_CARD_INDEX === "undefined" || !Array.isArray(MASTER_CARD_INDEX)) return [];
  const validWeather = weatherId && typeof WEATHER !== "undefined" && WEATHER[weatherId];
  let rawCards = [];
  if(validWeather){
    rawCards = MASTER_CARD_INDEX.filter(c => c && c.weatherOnly === weatherId);
  } else {
    rawCards = MASTER_CARD_INDEX
      .filter(c => c && !!c.weatherOnly)
      .slice()
      .sort((a,b) => ((b.chance || (typeof chanceOf === "function" ? chanceOf(b.tier) : 0)) - (a.chance || (typeof chanceOf === "function" ? chanceOf(a.tier) : 0))))
      .slice(0, 8);
  }
  return rawCards.map(c => {
    const cid = c.char_id || c.id;
    const wId = c.weatherOnly;
    const wDef = (typeof WEATHER !== "undefined" && WEATHER[wId]) || null;
    const ch = (typeof luckChance === "function") ? luckChance(cid) : (c.chance || 0);
    const rLabel = (typeof rarityText === "function") ? rarityText(c.tier, ch) : ("1 in " + ch);
    const tSrc = (typeof thumbSrc === "function") ? thumbSrc(c.sprite_asset) : (c.sprite_asset || "");
    const isOwned = !!(state && Array.isArray(state.stacks) && state.stacks.some(s => s && s.char === cid));
    return {
      char_id: cid,
      name: c.name || cid,
      tier: c.tier || "R",
      sprite_asset: c.sprite_asset,
      thumb: tSrc,
      weatherId: wId,
      weatherName: (wDef && wDef.name) || wId,
      weatherColor: (wDef && wDef.color) || "#38bdf8",
      chance: ch,
      rarityLabel: rLabel,
      owned: isOwned
    };
  });
};
function _l12_end_pot(){
}
/* Panel weather GABUNGAN (pojok kiri bawah): nama + "Ends in Xs" di atas, baris kartu
   weatherOnly (gaya index, hover reveal penuh) di tengah, buff luck/rollspeed di bawah.
   Nongol cuma pas weather aktif. Dipanggil tiap renderShell & tick detik. */
function renderWeatherDock(){
  if(typeof l12UpdateWeatherDock === 'function') l12UpdateWeatherDock(true);
  const panel=document.getElementById("weatherPanel");if(!panel)return;
  const id=activeWeatherId();const w=id?WEATHER[id]:null;
  const cards=MASTER_CARD_INDEX.filter(c=>c.weatherOnly===id);
  if(!w){panel.classList.remove("show");panel.innerHTML="";panel.dataset.wid="";return;}
  const byUser=(state&&state.weather&&state.weather.activated_by)?String(state.weather.activated_by):"";
  const expectedWid=String(id)+"|"+byUser;
  if(panel.dataset.wid===expectedWid&&panel.classList.contains("show")){
    const wp=panel.querySelector(".wp-timer-val");
    if(wp&&state.weather)wp.textContent=fmtCountdown(state.weather.endsAt-Date.now());
    return;
  }
  const safeUser=byUser.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
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
    +(byUser?`<div class="wp-buyer-bar" title="Diaktifkan oleh ${safeUser}">
      <span class="wp-buyer-ic">👑</span>
      <span class="wp-buyer-lbl">BY:</span>
      <span class="wp-buyer-name">${safeUser.toUpperCase()}</span>
    </div>`:"")
    +(cards.length?`<div class="wp-cards">`+cards.map(c=>
        `<div class="wc-slot active" data-wc="${c.char_id}" style="--wc:${w.color}">
          <span class="idx-art"><img src="${thumbSrc(c.sprite_asset)}" alt="" loading="lazy" decoding="async"></span>
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
  panel.dataset.wid=expectedWid;
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
  const adMs=(typeof adLuckLeftMs==="function")?adLuckLeftMs():0;
  if(!ls.length&&!ss.length&&!(adMs>0)){
    if(el.classList.contains("show")){el.classList.remove("show");el.innerHTML="";el.dataset.bkey="";}
    return;
  }
  const bKey=(adMs>0?"ad:1|":"ad:0|")+ls.map(b=>b.lv+":"+Math.round(b.endsAt/1000)).join(",")+"|"+ss.map(b=>b.lv+":"+Math.round(b.endsAt/1000)).join(",");
  if(el.dataset.bkey===bKey&&el.classList.contains("show")){
    el.querySelectorAll(".bd-badge").forEach(b=>{
      const ends=b.getAttribute("data-ends");
      if(ends)b.textContent=fmtCountdown(+ends-now);
    });
    return;
  }
  el.dataset.bkey=bKey;
  /* Slot chip: badge timer countdown di atas + ikon tengah. emoji = fallback kalau img gagal.
     Tooltip hover (bukan title native): main = nama, sub = deskripsi passive + sisa waktu. */
  const chip=(cls,src,emoji,main,sub,ms)=>`<div class="bd-chip ${cls}">
      <span class="bd-badge" data-ends="${Date.now()+ms}">${fmtCountdown(ms)}</span>
      <span class="bd-ic"><img src="${src}" alt="" onerror="this.parentNode.textContent='${emoji}'"></span>
      <span class="bd-tip"><b>${main}</b><small>${sub}</small></span>
    </div>`;
  let html="";
  if(adMs>0){
    html+=chip("luck","assets/images/pot-luck-3.webp","🎬",
      "ADS 2× LUCK BOOST",
      `2× TOTAL LUCK · sisa ${fmtCountdown(adMs)}`,adMs);
  }
  ls.forEach(b=>{
    const lTxt=b.lv>0?"L"+b.lv+" ":"";
    const p=b.pct||0;
    html+=chip("luck","assets/images/pot-luck-"+b.lv+".webp","🍀",
      `LUCK ${lTxt}POTION`.trim(),
      `+${b.flat||0} FLAT${p>0?` · +${Math.round(p*100)}%`:""} LUCK · sisa ${fmtCountdown(b.endsAt-now)}`,b.endsAt-now);
  });
  ss.forEach(b=>{
    const lTxt=b.lv>0?"L"+b.lv+" ":"";
    html+=chip("speed","assets/images/pot-speed-"+b.lv+".webp","⚡",
      `SPEED ${lTxt}POTION`.trim(),
      `+${(b.add||0).toFixed(1)}× SPEED · sisa ${fmtCountdown(b.endsAt-now)}`,b.endsAt-now);
  });
  el.innerHTML=html;
  el.classList.add("show");
}
function toast(main,sub,color){
  const t=document.getElementById("weatherToast");if(!t)return;
  const col=color||"#38bdf8";
  t.style.setProperty("--wdc",col);
  t.style.zIndex = "200000";

  try {
    if(typeof sfx!=="undefined"&&sfx&&typeof sfx.pop==="function") sfx.pop();
    else if(typeof beep==="function") beep(620,.08,"sine",.04);
  } catch(e) {}

  t.innerHTML=`
    <div class="cp-toast-frame" style="position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:3px;min-width:180px;">
      <span class="cp-toast-corner tl" style="position:absolute;top:-2px;left:-2px;width:6px;height:6px;border-top:2px solid var(--wdc,${col});border-left:2px solid var(--wdc,${col});pointer-events:none;"></span>
      <span class="cp-toast-corner tr" style="position:absolute;top:-2px;right:-2px;width:6px;height:6px;border-top:2px solid var(--wdc,${col});border-right:2px solid var(--wdc,${col});pointer-events:none;"></span>
      <span class="cp-toast-corner bl" style="position:absolute;bottom:-2px;left:-2px;width:6px;height:6px;border-bottom:2px solid var(--wdc,${col});border-left:2px solid var(--wdc,${col});pointer-events:none;"></span>
      <span class="cp-toast-corner br" style="position:absolute;bottom:-2px;right:-2px;width:6px;height:6px;border-bottom:2px solid var(--wdc,${col});border-right:2px solid var(--wdc,${col});pointer-events:none;"></span>
      <div class="cp-toast-scanline" style="position:absolute;inset:0;background:linear-gradient(rgba(18,28,38,0) 50%, rgba(0,0,0,0.25) 50%), linear-gradient(90deg, rgba(255,0,0,0.03), rgba(0,255,0,0.01), rgba(0,0,255,0.03));background-size:100% 2px, 3px 100%;pointer-events:none;opacity:0.6;"></div>
      <div class="cp-toast-tag" style="display:inline-flex;align-items:center;gap:5px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:800;letter-spacing:0.12em;color:var(--wdc,${col});text-transform:uppercase;opacity:0.95;">
        <span class="cp-toast-dot" style="display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--wdc,${col});box-shadow:0 0 6px var(--wdc,${col});"></span>
        <span>SYSTEM // NOTIFICATION</span>
      </div>
      <div class="cp-toast-main" style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;letter-spacing:0.04em;color:#fff;line-height:1.2;text-transform:uppercase;">${main}</div>
      ${sub ? `<div class="cp-toast-sub" style="font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:600;letter-spacing:0.02em;color:#94a3b8;line-height:1.25;margin-top:2px;">${sub}</div>` : ''}
    </div>
  `;
  t.classList.add("show","cp-toast");
  if(toast._tm) clearTimeout(toast._tm);
  const dur = (sub && String(sub).length > 30) ? 2800 : 2300;
  toast._tm = setTimeout(() => {
    t.classList.remove("show");
  }, dur);
}

/* ====== ANIMASI BROADCAST GLOBAL (GLOBAL LUCK & WEATHER INSTAN) ======
   Menampilkan animasi sinematik ke seluruh pemain di server ketika ada pemain
   yang membeli/mengaktifkan Global Luck atau Weather Instan, lengkap dengan
   nama pembeli, efek buff, dan partikel bercahaya. */
let _seenGlobalBroadcasts = {};
function _markGlobalBroadcastSeen(key) {
  if (!key) return;
  _seenGlobalBroadcasts[key] = Date.now();
  try { sessionStorage.setItem("acb_global_bcast_seen", JSON.stringify(_seenGlobalBroadcasts)); } catch (e) {}
}
function _hasSeenGlobalBroadcast(key) {
  if (!key) return true;
  if (!Object.keys(_seenGlobalBroadcasts).length) {
    try { _seenGlobalBroadcasts = JSON.parse(sessionStorage.getItem("acb_global_bcast_seen") || "{}") || {}; } catch (e) {}
  }
  return !!_seenGlobalBroadcasts[key];
}

function showGlobalEventBroadcast(opts) {
  opts = opts || {};
  const eventKey = opts.key || "";
  if (eventKey && _hasSeenGlobalBroadcast(eventKey)) return;
  if (eventKey) _markGlobalBroadcastSeen(eventKey);

  const color = opts.color || "#38bdf8";
  const badge = opts.badge || "SERVER EVENT · GLOBAL BROADCAST";
  const title = opts.title || "GLOBAL BUFF ACTIVATED";
  const buyer = String(opts.buyer || "HUNTER").toUpperCase();
  const effect = opts.effect || "";
  const iconHtml = opts.iconHtml || "";

  let host = document.getElementById("globalBroadcastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "globalBroadcastHost";
    document.body.appendChild(host);
  }
  if (host._hideTm) clearTimeout(host._hideTm);
  if (host._rmTm) clearTimeout(host._rmTm);

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  host.innerHTML = `
    <div class="gbcast-overlay" style="--gbc:${color}">
      <div class="gbcast-flash"></div>
      <div class="gbcast-rays"></div>
      <div class="gbcast-banner">
        <div class="gbcast-scan"></div>
        <div class="gbcast-corner tl"></div>
        <div class="gbcast-corner tr"></div>
        <div class="gbcast-corner bl"></div>
        <div class="gbcast-corner br"></div>
        <div class="gbcast-badge"><span class="gbcast-dot"></span>${esc(badge)}</div>
        <div class="gbcast-main-row">
          <div class="gbcast-ic">${iconHtml}</div>
          <div class="gbcast-texts">
            <div class="gbcast-title">${esc(title)}</div>
            <div class="gbcast-buyer">DIBELI & DIAKTIFKAN OLEH <b class="gbcast-buyer-name">${esc(buyer)}</b></div>
          </div>
        </div>
        ${effect ? `<div class="gbcast-effect">${effect}</div>` : ""}
      </div>
    </div>
  `;

  try {
    beep(523.25, 0.14, "triangle", 0.11);
    setTimeout(() => beep(659.25, 0.16, "triangle", 0.12), 110);
    setTimeout(() => beep(783.99, 0.18, "triangle", 0.13), 220);
    setTimeout(() => beep(1046.5, 0.28, "triangle", 0.14), 340);
  } catch (e) {}

  const ov = host.querySelector(".gbcast-overlay");
  if (ov) {
    ov.onclick = () => {
      ov.classList.add("gbcast-out");
      setTimeout(() => { host.innerHTML = ""; }, 350);
    };
  }

  host._hideTm = setTimeout(() => {
    const el = host.querySelector(".gbcast-overlay");
    if (el) el.classList.add("gbcast-out");
  }, 4400);
  host._rmTm = setTimeout(() => {
    host.innerHTML = "";
  }, 4850);
}
window.showGlobalEventBroadcast = showGlobalEventBroadcast;
let weatherTickStarted=false;
let _globalWeatherSyncBusy=false;
let _lastGlobalWeatherPoll=0;
const GLOBAL_WEATHER_POLL_MS=8000;

async function syncGlobalWeather(silent){
  if(!state||!window.CloudDB||typeof window.CloudDB.getGlobalWeather!=="function")return null;
  if(_globalWeatherSyncBusy)return null;
  _globalWeatherSyncBusy=true;
  try{
    const gw=await window.CloudDB.getGlobalWeather();
    _lastGlobalWeatherPoll=Date.now();
    if(!gw||!gw.ok||!gw.id||!WEATHER[gw.id])return null;
    const wDef=WEATHER[gw.id];
    const now=Date.now();
    const cur=state.weather&&state.weather.endsAt>now?state.weather:null;
    const isGlobalInstant=!!gw.activated_by;
    const curKey=cur?(cur.id+"|"+(cur.activated_by||"")+"|"+Math.round((cur.endsAt||0)/1000)):"";
    const newKey=gw.id+"|"+(gw.activated_by||"")+"|"+Math.round((gw.endsAt||0)/1000);

    // Terapkan cuaca global jika:
    // 1. Belum ada cuaca aktif di client, ATAU
    // 2. Ada yang membeli Weather Instan di server (activated_by ada) yang berbeda dari state sekarang, ATAU
    // 3. Cuaca global server memiliki rarity lebih bagus/sama atau cuaca saat ini juga berasal dari server global
    const curIsPersonalPotion=cur&&!cur.activated_by&&((cur.endsAt-now)<=WEATHER_MS+5000)&&cur.id!==gw.id;
    if(!cur||isGlobalInstant||!curIsPersonalPotion||weatherRank(gw.id)<=weatherRank(cur.id)){
      if(curKey!==newKey){
        const prevId=cur?cur.id:null;
        const prevBy=cur?(cur.activated_by||""):"";
        state.weather={id:gw.id,endsAt:Number(gw.endsAt)||now+WEATHER_ROTATE_MS,activated_by:gw.activated_by||null};
        state.weatherBest=betterWeather(state.weatherBest,gw.id);
        renderWeatherDock();
        renderBuffDock();
        renderShell();
        if(typeof renderPremiumShop==="function"&&document.getElementById("premiumModal")?.classList.contains("show")){
          renderPremiumShop();
        }
        if(gw.activated_by){
          const wKey="gw:"+gw.id+":"+gw.activated_by+":"+Math.round((Number(gw.endsAt)||0)/1000);
          if(silent){
            _markGlobalBroadcastSeen(wKey);
          }else{
            showGlobalEventBroadcast({
              key: wKey,
              color: wDef.color || "#38bdf8",
              badge: "SERVER EVENT · INSTANT WEATHER",
              title: "CUACA " + wDef.name + " DIAKTIFKAN!",
              buyer: gw.activated_by,
              effect: `BUFF SELURUH SERVER: <b>${wDef.luckBonus}× LUCK</b> & <b>${wDef.speedBonus}× ROLL SPEED</b> SELAMA 30 MENIT!`,
              iconHtml: weatherSvg(wDef.id, 42)
            });
          }
        }else if(!silent&&prevId!==gw.id){
          toast(`<span style="display:inline-flex;align-items:center;gap:8px">${weatherSvg(wDef.id,22)} ${wDef.name}</span>`,"ROTASI CUACA SERVER · 30 MENIT",wDef.color);
          beep(520,.14,"sine",.06);setTimeout(()=>beep(700,.16,"sine",.06),130);
        }
        return wDef;
      }
    }
  }catch(e){}finally{
    _globalWeatherSyncBusy=false;
  }
  return null;
}
window.syncGlobalWeather=syncGlobalWeather;

function startWeatherTick(){
  if(weatherTickStarted)return;weatherTickStarted=true;
  /* ensureWeather: sinkronkan cuaca dari server global_weather agar semua server/pemain
     mendapat rotasi 30 menit yang sama persis + langsung merasakan Weather Instan yang dibeli pemain lain. */
  const ensureWeather=silent=>{
    if(!state)return null;
    if(state.weather&&Date.now()<state.weather.endsAt){
      if(Date.now()-_lastGlobalWeatherPoll>=GLOBAL_WEATHER_POLL_MS&&!document.hidden){
        syncGlobalWeather(false);
      }
      return null;
    }
    syncGlobalWeather(silent);
    return null;
  };
  window.ensureWeather=ensureWeather;
  syncGlobalWeather(true);       /* tarik cuaca global server pas boot */
  renderShell();                 /* refresh UI */
  setInterval(()=>{
    if(!state)return;
    const hadActive=!!state.weather&&Date.now()<state.weather.endsAt;
    ensureWeather(false);
    const _wp=document.getElementById("weatherPanel");
    const byUser=(state&&state.weather&&state.weather.activated_by)?String(state.weather.activated_by):"";
    const expectedWid=activeWeatherId()?(String(activeWeatherId())+"|"+byUser):"";
    const staleDock=!!_wp&&_wp.dataset.wid!==expectedWid;
    if((!hadActive&&state.weather)||staleDock){
      renderWeatherDock();renderBuffDock();renderShell();
      if(typeof l12UpdateWeatherDock === 'function') l12UpdateWeatherDock(true);
    }else{
      if(typeof l12UpdateWeatherDock === 'function') l12UpdateWeatherDock();
      const wp=document.querySelector(".wp-timer-val");if(wp&&state.weather)wp.textContent=fmtCountdown(state.weather.endsAt-Date.now());
      let buffExpired=false;
      document.querySelectorAll(".bd-badge").forEach(b=>{
        const ends=b.getAttribute("data-ends");
        if(ends){
          const rem=+ends-Date.now();
          if(rem<=0)buffExpired=true;
          else b.textContent=fmtCountdown(rem);
        }
      });
      if(buffExpired)renderBuffDock();
    }
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

/* ===== DEDUP POLICY (v203-instaExp) =====
   Setiap varian kartu (char + mut + shiny) cuma boleh ADA SATU DI SAVE — tidak pernah count++,
   tidak pernah dua stack. Guard dipasang di dua tempat supaya save yang dikirim ke Supabase
   dijamin bersih:
     1. grantRolledCard (jalur normal roll + instantpack)
     2. save() di state.js (safety-net terakhir sebelum serialize — menutup celah import save
        lama, dev-grant, dsb.).
   Kompensasi duplikat:
     • Semua jalur (roll manual & instantpack) → dup dikompensasi jadi REBIRTH essence
       lewat addRebirthEssence(). Dulu: manual dibuang silent, instantpack jadi EXP player.
       Sekarang nilai dup tidak lagi menyentuh state.player.exp, jadi farming jutaan dup
       menaikkan luck (via rebirth) tanpa merusak level player.
     • Stack tidak pernah nampung copy → tetap 1 per varian di Supabase. */
function stackVariantKey(s){return s.char+"|"+(s.mut||"none")+"|"+(s.shiny?1:0);}
function dedupStacksInPlace(){
  if(!state||!Array.isArray(state.stacks))return;
  const seen=new Set();
  const out=[];
  for(const s of state.stacks){
    const k=stackVariantKey(s);
    if(seen.has(k))continue;
    seen.add(k);
    s.count=1;
    if(typeof CARDS!=="undefined"&&CARDS[s.char])s.tier=CARDS[s.char].tier||null;
    out.push(s);
  }
  if(out.length!==state.stacks.length)state.stacks=out;
}
/* Harga essence per duplikat. Tier × mut × shiny. */
const DUP_EXP_TIER = { R:20, SR:40, SSR:90, UR:220, EX:600, BOSS:600 };
const DUP_EXP_MUT  = { none:1, gold:2, rainbow:3, secret:5, ultima:8 };
const DUP_EXP_SHINY = 2;
function dupSellValue(card, mut, shiny){
  if(!card)return 0;
  let base = 20;
  if(card.tier && DUP_EXP_TIER[card.tier]){
    base = DUP_EXP_TIER[card.tier];
  } else if(card.chance){
    const ch = card.chance;
    if(ch >= 1000000) base = 600;
    else if(ch >= 500000) base = 220;
    else if(ch >= 150000) base = 90;
    else if(ch >= 50000) base = 40;
    else base = 20;
  }
  const mm   = DUP_EXP_MUT[mut || "none"] || 1;
  return Math.round(base * mm * (shiny ? DUP_EXP_SHINY : 1));
}
function dupAddExp(exp){
  /* Kompensasi duplikat sekarang masuk REBIRTH essence, bukan EXP player
     (lihat state.js REBIRTH). Fungsi ini dipertahankan cuma sebagai alias
     supaya jalur lama tidak berubah makna angka. */
  return typeof addRebirthEssence==="function"?addRebirthEssence(exp):0;
}

function grantRolledCard(charId, mut, shiny, dupToExp) {
  const card = CARDS[charId];
  if (!card || !state) return null;
  if (!Array.isArray(state.stacks)) state.stacks = [];
  const m = mut || "none";
  const sh = !!shiny;
  if (!__batchRoll && typeof lbTrackPull === "function") lbTrackPull(charId, m, sh);
  const s = state.stacks.find(x => x.char === charId && (x.mut || "none") === m && !!x.shiny === sh);
  if (s) {
    /* DUPLIKAT — stack existing tetap count=1 (tidak ada copy yang nempel di save).
       Semua dup (manual roll & instantpack) dikompensasi jadi REBIRTH essence. */
    addRebirthEssence(dupSellValue(card, m, sh));
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
/* Instant roll massal (dipakai reward Infinite Tower): n roll sekaligus, simpan sekali di akhir.
   Dup di jalur ini dikompensasi EXP. */
const MAX_ROLL_HISTORY = 10;
let _rhistRaf = 0;
function pushRollHistory(entry, skipPaint) {
  if (!state || !entry) return;
  const cid = entry.cardId || entry.char;
  if (!cid || !CARDS[cid]) return;
  if (!Array.isArray(state.rollHistory)) state.rollHistory = [];
  const c = CARDS[cid];
  const mut = entry.mut || "none";
  const shiny = !!entry.shiny;
  const ch = entry.chance || ((c.chance || (typeof chanceOf === "function" ? chanceOf(c.tier) : 100)) * (shiny ? (typeof SHINY_CHANCE_MULT !== "undefined" ? SHINY_CHANCE_MULT : 50) : 1) * ((typeof MUT_CHANCE_MULT !== "undefined" ? MUT_CHANCE_MULT[mut] : 1) || 1));
  state.rollHistory.unshift({
    char: cid,
    tier: c.tier || "C",
    mut: mut,
    shiny: shiny,
    chance: ch,
    n: entry.n || 1,
    ts: Date.now()
  });
  if (state.rollHistory.length > MAX_ROLL_HISTORY) {
    state.rollHistory.length = MAX_ROLL_HISTORY;
  }
  if (!skipPaint && typeof window.l12ScheduleRollHistPaint === "function") {
    window.l12ScheduleRollHistPaint();
  }
}
window.pushRollHistory = pushRollHistory;
window.MAX_ROLL_HISTORY = MAX_ROLL_HISTORY;

function instantRoll(n){
  __batchRoll=true;
  const res=[];
  try{ for(let i=0;i<n;i++){ const r=rngRoll(totalLuck()); if(!r)continue; grantRolledCard(r.cardId,r.mut,r.shiny,true); res.push(r);} }
  finally{ __batchRoll=false; }
  if(res.length){
    res.slice(-10).forEach(r=>pushRollHistory(r,true));
    if(typeof window.l12ScheduleRollHistPaint==="function")window.l12ScheduleRollHistPaint();
  }
  if(state)state.totalRolls=(state.totalRolls||0)+n;
  save(); rollCountBadge();
  if(typeof lbTrackOwnedBest==="function")lbTrackOwnedBest();
  return res;
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
  /* 0042: `idxServerOwned` diisi oleh RPC claim_index_reward — kalau ada, pakai
     angka server supaya tombol KLAIM tidak menampilkan "+N" palsu untuk pemain
     yang F12-nya nambahin stacks. Tanpa server (guest / sebelum klaim pertama),
     fallback ke cermin client. */
  const count=(state&&typeof state.idxServerOwned==="number")?state.idxServerOwned:owned.size;
  return {owned:owned,count:count,total:total,blocks:Math.floor(count/IDX_MILESTONE),claimed:(state&&state.idxRewardsClaimed)||0};
}
function idxRewardSync(silent){
  // Hanya read progress, klaim dilakukan manual oleh pemain lewat tombol di Index footer
  return 0;
}
async function claimIndexReward(){
  if(!state)return;
  /* 0042 (Unit 5b-3): klaim dihitung SERVER dari ledger varian sah, bukan dari
     cermin save_data.stacks. Tombol ini sekarang RPC; kalau sesi cloud hidup
     tapi RPC gagal (network / JWT expired), TIDAK fallback ke client-mint —
     itu persis lubang yang kita tutup. */
  if(typeof srOn==="function"&&srOn()&&typeof CloudDB!=="undefined"&&CloudDB.claimIndexReward){
    const r=await CloudDB.claimIndexReward(currentUser);
    if(!r){ toast("INDEX REWARD","KONEKSI KE SERVER PUTUS · COBA LAGI","#f87171"); return; }
    if(!r.ok){
      const ms=Math.max(1,Number(r.milestone)||IDX_MILESTONE);
      const need=Math.max(0,ms-((Number(r.owned)||0)%ms));
      toast("BELUM BISA KLAIM","Server: kumpulkan "+need+" varian index lagi!","#f87171");
      if(typeof ixRender==="function")ixRender();
      return;
    }
    const gain=Math.max(1,Number(r.gain)||1);
    beep(640,.16,"triangle",.09);setTimeout(()=>beep(960,.22,"triangle",.08),120);
    toast("INDEX REWARD DIKLAIM!","+"+gain+" INSTAN ROLL 5.000 PACK · CEK BACKPACK","#FFD700");
    if(typeof ixRender==="function")ixRender();
    return;
  }
  /* Jalur lokal hanya untuk guest (tidak ada save di server yang bisa dicuri). */
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
   pemilihan lewat binary search prefix (bukan rngRoll berulang) — 100k roll dalam hitungan detik.
   agg=true -> hasil digabung per varian (pakai r.n) supaya multiplies besar tidak meledakkan memori. */
function instantRollFast(n, agg){
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
  const groups=(agg)?{}:null;
  let totalPulls=0;
  try{
    for(let i=0;i<n;i++){
      const e=pick();
      grantRolledCard(e.card.char_id,e.mut,e.shiny,true);
      totalPulls++;
      if(groups){
        const key=e.card.char_id+'|'+(e.mut||'none')+'|'+(e.shiny?'true':'none');
        const g=groups[key]||(groups[key]={cardId:e.card.char_id,tier:e.card.tier,mut:e.mut,shiny:e.shiny,chance:e.ch,n:0});
        g.n++;
      } else {
        res.push({cardId:e.card.char_id,tier:e.card.tier,mut:e.mut,shiny:e.shiny,chance:e.ch});
      }
    }
  } finally{ __batchRoll=false; }
  if(groups) for(const k in groups) res.push(groups[k]);
  if(res.length){
    res.slice().sort((a,b)=>(a.chance||0)-(b.chance||0)).slice(-10).forEach(g=>pushRollHistory(g,true));
    if(typeof window.l12ScheduleRollHistPaint==="function")window.l12ScheduleRollHistPaint();
  }
  if(state)state.totalRolls=(state.totalRolls||0)+totalPulls;
  save(); rollCountBadge(); idxRewardSync(true);
  if(typeof lbTrackOwnedBest==="function")lbTrackOwnedBest();
  res.totalPulls=totalPulls;
  return res;
}

function rollCountBadge() {
  const toggle = document.getElementById('backpackToggle');
  if (toggle && state) {
    const count = state.stacks.length;
    toggle.setAttribute('data-count', count);
    toggle.classList.toggle('has-items', count > 0);
  }
  if (typeof updateRebirthUI === "function") updateRebirthUI();
}

/* ===== ROLL SERVER-AUTHORITATIVE (Unit 4 — RPC roll_pull, migrasi 0034-0036) =====
   Roll manual + AUTO memakai hasil dari server: server yang ngacak, nulis kartu baru,
   bayar esens dup, dan menaikkan totalRolls di save_data. Client cuma mirror.

   KENAPA TIDAK BOLEH FALLBACK KE RNG LOKAL SAAT SESI HIDUP:
   roll itu gratis, jadi satu klik = satu kartu. Kalau RPC-nya jalan di server tapi
   client ikut ngacak lokal (karena queue kosong / RPC lambat), pemain dapat DUA kartu
   untuk satu klik dan server tidak bisa membedakan itu dari save biasa. Maka:
     - tanpa sesi cloud (main lokal / offline)   -> jalur lama, rngRoll() client, tetap bisa main;
     - dengan sesi                               -> antrean hasil server; kalau RPC gagal,
       tick berikutnya JEDA (bukan roll lokal), lalu toast setelah beberapa detik.
   PREFETCH 1 RPC = 10 hasil: batas 120 RPC/menit (0033) tetap aman untuk speed maksimum
   (RNG_ROLL_MAX_MULT), dan latensi RPC tersembunyi di balik animasi reveal. */
const SROLL_BATCH = 10;      /* hasil per RPC (roll_pull clamp 1..100, 10 cukup buat 1-2 detik auto) */
const SROLL_KEEP = 4;        /* di bawah ini antrean diam-diam diisi lagi */
const SRoll = { q: [], busy: null, downUntil: 0, lastErr: "", warnAt: 0 };
function srSession(){
  try {
    if (!(window.CloudDB && window.CloudAuth && typeof currentUser !== "undefined" && currentUser && state)) return false;
    /* Aturan: TANPA sesi cloud (belum login / offline) = jalur lama RNG lokal, persis
       seperti sebelum Unit 4 — pemain itu toh tidak bisa push save, jadi tidak ada
       yang bisa dicurangi lewat jalur ini. DENGAN sesi = wajib server; di situ fallback
       lokal DILARANG karena server bisa melihat kartu yang tidak pernah di-pull. */
    const s = window.CloudAuth.session(currentUser);
    return !!(s && s.at && (!s.exp || s.exp > Date.now()));
  }
  catch (e) { return false; }
}
/* true = roll WAJIB dari server. */
function srOn(){ return srSession(); }
function srShape(r, sp){
  return { cardId: r.cardId, tier: r.tier || null, mut: r.mut || "none", shiny: !!r.shiny,
           chance: r.chance, effChance: r.eff, speedBoost: sp || 1,
           server: true, dup: !!r.dup, stackId: r.stackId || null };
}
function srWarn(){
  /* Jangan toast tiap tick — satu peringatan per beberapa detik cukup. */
  if (Date.now() - SRoll.warnAt < 6000) return;
  SRoll.warnAt = Date.now();
  if (typeof toast === "function") toast("SERVER ROLL SIBUK", "Sambungan ke server terputus — roll dijeda sebentar.", "#f87171");
}
/* Isi antrean sampai >= min. Fire-and-forget untuk tick yang lagi jalan; di-await
   untuk roll manual pertama. Return promise<boolean> = apakah hasil tersedia.
   `batch` = jumlah pull sekali RPC. ROLL MANUAL WAJIB 1 (lihat srOne): batch besar
   untuk satu klik berarti 9 kartu sudah masuk backpack padahal cuma 1 di-reveal,
   dan reload halaman membuat sisanya hangus sebagai kartu "gratis" per klik. */
function srEnsure(min, batch){
  if (!srOn()) return Promise.resolve(false);
  if (SRoll.q.length >= (min || SROLL_KEEP)) return Promise.resolve(true);
  if (SRoll.busy) return SRoll.busy;
  if (Date.now() < SRoll.downUntil) return Promise.resolve(false);
  const n = Math.max(1, Math.min(100, batch || SROLL_BATCH));
  SRoll.busy = (async () => {
    try {
      const res = await CloudDB.rollPull(currentUser, n, null);
      SRoll.busy = null;
      if (res && res.ok) {
        SRoll.downUntil = 0; SRoll.lastErr = "";
        for (const r of (res.results || [])) SRoll.q.push(srShape(r));
        return SRoll.q.length > 0;
      }
      SRoll.lastErr = (res && res.msg) || "RPC_GAGAL";
      SRoll.downUntil = Date.now() + 2500;
      srWarn();
      return false;
    } catch (e) {
      SRoll.busy = null; SRoll.lastErr = (e && e.message) || "ERROR";
      SRoll.downUntil = Date.now() + 2500; srWarn();
      return false;
    }
  })();
  return SRoll.busy;
}
/* Ambil satu hasil siap pakai; null kalau belum ada. */
function srTake(sp){
  if (!SRoll.q.length) return null;
  const r = SRoll.q.shift();
  r.speedBoost = sp || 1;
  /* Keep-warm HANYA untuk auto-roll. Kalau jalan di reveal manual, satu klik
         diam-diam menarik 10 pull (9 kartu masuk backpack tanpa pernah di-reveal). */
  if (rollState && rollState.active) srEnsure(SROLL_KEEP);
  return r;
}
/* Ganti akun / logout: hasil di antrean sudah jadi milik akun LAMA di server,
   jadi tidak boleh direveal di akun baru. */
function srReset(){ SRoll.q.length = 0; SRoll.busy = null; SRoll.downUntil = 0; SRoll.lastErr = ""; }
window.srReset = srReset;
/* Jalan roll manual: antrean dulu, kalau kosong tunggu satu RPC (reveal telat ~ratusan ms,
   itu harga dari peluang yang jujur). null = server bermasalah, caller jangan ngacak lokal.
   batch 1: satu klik = satu pull = satu kartu, persis seperti jalur lama. */
async function srOne(sp){
  const now = srTake(sp);
  if (now) return now;
  const ok = await srEnsure(1, 1);
  return ok ? srTake(sp) : null;
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
  if(window.cgGameplayStart) window.cgGameplayStart();
  rollState.hideOverlay = false;

  const rollBtn = document.getElementById('rollBtn');
  if (rollBtn) rollBtn.classList.add('active');
  const ra = document.getElementById('rollAutoBtn');
  if (ra) ra.classList.add('on');
  if (rollState.hideTimer) { clearTimeout(rollState.hideTimer); rollState.hideTimer = null; }

  // Set initial delay based on speed multiplier
  const initialDelay = Math.max(RNG_ROLL_MIN, RNG_ROLL_SPEED / rollState.speedMultiplier);
  if (srOn()) srEnsure(SROLL_KEEP); /* prefetch diam-diam biar tick pertama tidak nunggu RPC */
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
function srScheduleNext(){
  if(!rollState.active)return;
  const d=Math.max(RNG_ROLL_MIN,RNG_ROLL_SPEED/rollState.speedMultiplier);
  if(rollState.interval){clearTimeout(rollState.interval);rollState.interval=null;}
  rollState.interval=setTimeout(rollTick,d);
  if(window.__afkHeartbeat&&typeof window.__afkHeartbeat.postDelay==="function"){
    window.__afkHeartbeat.postDelay(d);
  }
}
window.forceResumeRoll=function(){
  if(!rollState||!rollState.active)return;
  if(rollState.interval){clearTimeout(rollState.interval);rollState.interval=null;}
  rollTick();
};
async function rollTick(){
  if(!rollState.active)return;
  rollState.luck=rollState.luckPinned||rollLuckNow();
  rollState.speedMultiplier=rollSpeedNow();
  let result=null, fromServer=false;
  if(srOn()){
    result=srTake(rollState.speedMultiplier);
    fromServer=!!result;
    if(!result){
      await srEnsure(1);
      if(!rollState.active)return;               /* player tekan stop saat nunggu RPC */
      result=srTake(rollState.speedMultiplier);
      fromServer=!!result;
      if(!result){ srScheduleNext(); return; }   /* server sibuk: JEDA, bukan roll lokal */
    }
  } else {
    result=rngRoll(rollState.luck,rollState.speedMultiplier);
    if(!result){stopRollAnimation();hideRollResult();return;}
  }
  // Tambah EXP (50/roll) sebagai delta server-authoritative (0026)
  xpGain(50);
  /* Jalur lokal: counter lifetime naik di sini. Jalur server TIDAK: roll_pull sudah
     menambahkan `res.total` di CloudDB.rollPull begitu batch turun (termasuk kartu yang
     belum di-reveal), jadi menghitung di sini = dobel. */
  if(!fromServer && state)state.totalRolls=(state.totalRolls||0)+1;
  if(!fromServer)grantRolledCard(result.cardId,result.mut,result.shiny);
  else if(typeof rollCountBadge==="function"){
    /* Kartu baru + esens dup sudah diterapkan CloudDB.rollPull saat batch turun
       (itu penting: server sudah menulisnya di DB, jadi client tidak boleh grant ulang). */
    rollCountBadge();
  }
  if(result.shiny || (result.mut && result.mut !== 'none')) {
    if(window.cgHappyTime) window.cgHappyTime();
  }
  showRollResult(result);
  renderShell(); // Update XP bar & level check
  srScheduleNext();
}

function stopRollAnimation() {
  rollState.active = false;
  if(window.cgGameplayStop) window.cgGameplayStop();
  if (rollState.interval) {
    clearTimeout(rollState.interval);
    rollState.interval = null;
  }
  if (rollState.hideTimer) {
    clearTimeout(rollState.hideTimer);
    rollState.hideTimer = null;
  }
  /* Roll berhenti → push sisa perubahan ke Supabase sekali (throttle-nya ada di state.js save()). */
  if (typeof flushCloudSave === "function") flushCloudSave();
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

function showRollResult(result, fromHistoryPreview) {
  if (result && !fromHistoryPreview) {
    pushRollHistory(result);
  }
  const overlay = document.getElementById('rollOverlay');
  if (!overlay) return;
  if (rollState.hideOverlay && !fromHistoryPreview) return;
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
  showcase.style.borderColor = mut ? MUT_COLOR[mut] : ((CARDS[eq.char].tier && TIER_COLOR[CARDS[eq.char].tier]) || "var(--cyan)");
  showcase.style.setProperty('--tcol', mut ? (MUT_COLOR[mut] || '#7DF9FF') : ((CARDS[eq.char].tier && TIER_COLOR[CARDS[eq.char].tier]) || '#7DF9FF'));

  // Buka overlay. Animasi masuk HANYA sekali (saat pertama tampil) supaya tidak flicker muncul-hilang tiap tick.
  const wasVisible = overlay.style.display === 'flex';
  overlay.style.display = 'flex';
  // Cinematic reveal (port dari _tmp/reveal-proto): slam + flash + particles - hanya saat baru buka
  if (!wasVisible) {
    showcase.style.transition = 'none';
    showcase.classList.remove('rv-slam'); void showcase.offsetWidth; showcase.classList.add('rv-slam');
    const tcol = mut ? (MUT_COLOR[mut] || '#7DF9FF') : ((CARDS[eq.char].tier && TIER_COLOR[CARDS[eq.char].tier]) || '#7DF9FF');
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
  const b=document.getElementById("profBackdrop");const m=document.getElementById("profModal");if(b){b.classList.add("show");b.style.display="block";}if(m){m.classList.add("show");m.style.display="flex";renderProfile();profTabGo("overview");profHoverBind();}
}
function closeProfileModal(){hoverHide();const b=document.getElementById("profBackdrop");const m=document.getElementById("profModal");if(b){b.classList.remove("show");b.style.display="none";}if(m){m.classList.remove("show");m.style.display="none";}}

/* Tab menu profil (gaya menu karakter): rail kiri + halaman kanan */
const PROF_TABS={overview:"RINGKASAN OPERATOR",stats:"STATISTIK & TELEMETRI",achievements:"PENCAPAIAN & TITLE",koleksi:"KOLEKSI KARTU",progres:"PROGRES PETUALANGAN",ekuipmen:"EKUIPMEN & ARTEFAK",item:"ITEM & BUFF",titles:"TITLES & GELAR"};



window.onStatCardClick = function(key, encodedInfo) {
  const info = decodeURIComponent(encodedInfo);
  if (typeof showToast === 'function') {
    showToast(info);
  } else if (typeof toast === 'function') {
    toast("TELEMETRI " + key.toUpperCase(), info, "#38bdf8");
  }
};

function updateProfileLiveNumbers(){
  if(!state)return;
  const pm=document.getElementById("profModal");
  if(!pm || pm.style.display==="none" || pm.style.display==="")return;
  const p=state.player||{};
  const lv=p.lv||state.playerLv||1;
  const xpNeed=lv*1000, curExp=p.exp||0;
  const xpPct=Math.max(0,Math.min(100,Math.round(curExp/xpNeed*100)));
  const spm=playerSpeedMult(), swm=weatherSpeedMult();
  const eff=Math.min(spm*swm,RNG_ROLL_MAX_MULT);
  const playSec=Math.floor(state.playSec||0);
  const fmtPlay=()=>{const h=Math.floor(playSec/3600),m=Math.floor(playSec%3600/60);return h>0?`${h}j ${m}m`:m>0?`${m}m ${playSec%60}s`:`${playSec}s`;};

  const _Kc=rollCommonScale();
  let rarest=null, rarestCh=-Infinity;
  for(const s of (state.stacks||[])){
    const c=CARDS[s.char]; if(!c)continue;
    const den=(c.chance||chanceOf(c.tier))*(s.shiny?SHINY_CHANCE_MULT:1)*(MUT_CHANCE_MULT[s.mut||"none"]||1);
    const ch=den>=ROLL_RARE_DEN?den:den/_Kc;
    if(ch>rarestCh){rarestCh=ch;rarest=s;}
  }

  const setText=(id,val)=>{
    const el=document.getElementById(id);
    if(el&&el.textContent!==String(val))el.textContent=val;
  };
  setText("pfLv",lv);
  setText("pfPower",fmt(totalPower()));
  setText("pfXpText",`${fmt(curExp)} / ${fmt(xpNeed)} · ${xpPct}%`);
  const xf=document.getElementById("pfXpFill");
  if(xf&&xf.style.width!==(xpPct+"%"))xf.style.width=xpPct+"%";

  const updateCardVal=(key,val,sub)=>{
    const vals=document.querySelectorAll(`[data-psc-val="${key}"]`);
    vals.forEach(el=>{if(el.textContent!==String(val))el.textContent=val;});
    if(sub!=null){
      const subs=document.querySelectorAll(`[data-psc-sub="${key}"]`);
      subs.forEach(el=>{if(el.textContent!==String(sub))el.textContent=sub;});
    }
  };
  updateCardVal("power",fmt(totalPower()));
  updateCardVal("luck",totalLuck().toFixed(1)+"×");
  updateCardVal("speed",eff.toFixed(1)+"×");
  updateCardVal("time",fmtPlay());
  updateCardVal("rolls",fmt(state.totalRolls||0));
  updateCardVal("rarest",rarest?cardName(rarest.char):"—",rarest?`1 IN ${fmtChance(rarestCh)}`:"NO DATA");
}
window.updateProfileLiveNumbers=updateProfileLiveNumbers;
window.profTab="overview";
function profTabGo(k){
  if(!PROF_TABS[k])return;
  window.profTab=k;
  const rail=document.getElementById("profRail");
  if(rail)rail.querySelectorAll(".prof-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===k));
  const pane=document.getElementById("profPane");
  if(pane){pane.querySelectorAll(".prof-page").forEach(p=>p.classList.toggle("active",p.dataset.page===k));pane.scrollTop=0;}
  const t=document.getElementById("pfPaneTitle");if(t)t.textContent=PROF_TABS[k];
}

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
  const p=state.player||{};
  const lv=p.lv||state.playerLv||1;
  const xpNeed=lv*1000, curExp=p.exp||0;
  const xpPct=Math.max(0,Math.min(100,Math.round(curExp/xpNeed*100)));
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  /* ---- hero kiri: title tag + avatar kartu utama + nama/level/XP ---- */
  const eq=equipped(); const cid=eq&&eq.char;
  /* Hero = kartu utama tampil sebagai CARD, pakai markup yang sama dengan kartu lobby. */
  const av=document.getElementById("pfAv");
  const heroKey=eq?[eq.id,eq.char,eq.mut||"",eq.trait||"",eq.shiny?1:0].join("|"):"none";
  if(av){
    av.style.cursor="pointer";
    av.title="Klik untuk kelola Dek di Backpack";
    av.onclick=()=>{if(typeof sfx!=="undefined"&&sfx.hit)sfx.hit();closeProfileModal();if(typeof toggleBackpack==="function"){toggleBackpack();if(typeof bpSetTab==="function")bpSetTab("deck");}};
    if(av.dataset.heroKey!==heroKey){
      av.dataset.heroKey=heroKey;
      av.innerHTML=(eq&&typeof hubCardHtml==="function")
        ?hubCardHtml(eq,'',false)
        :'<div class="hub-center"><div class="hc-info"><div class="hc-name">Belum ada kartu</div></div></div>';
    }
  }
  const bg=document.getElementById("pfBg");
  const bgSrc=(state&&state.customAvatar)?state.customAvatar:(cid&&CARDS[cid]?cardImg(cid):"");
  if(bg&&bg.dataset.bgSrc!==bgSrc){
    bg.dataset.bgSrc=bgSrc||"";
    bg.innerHTML=bgSrc?`<img src="${bgSrc}" alt=""${state.customAvatar?"":(CARDS[cid]&&CARDS[cid].pos?` style="object-position:${CARDS[cid].pos}"`:"")}>`:"";
  }
  set("pfName",currentUser||"GUEST");
  set("pfDeck",cid?("KARTU UTAMA · "+cardName(cid)):"KARTU UTAMA · —");
  set("pfLv",lv);
  set("pfPower",fmt(totalPower()));
  const xf=document.getElementById("pfXpFill");if(xf)xf.style.width=xpPct+"%";
  set("pfXpText",`${fmt(curExp)} / ${fmt(xpNeed)} · ${xpPct}%`);
  const curT = state.playerTitle || "ROOKIE";
  const pt=document.getElementById("pfTitleTag");
  if(pt){
    pt.className="prof-title-tag title-"+curT.toLowerCase().replace(/\s+/g,"_");
    pt.innerHTML=`<span class="ptt-crown"><svg width="15" height="12" viewBox="0 0 24 18" fill="none"><path d="M2 15L4 4L9 9L12 2L15 9L20 4L22 15H2Z" fill="currentColor" stroke="rgba(255,255,255,.55)" stroke-width="1.1" stroke-linejoin="round"/></svg></span><span class="ptt-txt">${curT}</span>`;
  }
  const tb=document.getElementById("pfTitlesBtn");
  if(tb)tb.onclick=()=>{ openTitlesModal(); };
  const statCard = (key, lab, val, iconSvg, color, sub, infoText) => `
    <div class="prof-stat-card psc-${key}" onclick="onStatCardClick('${key}', '${encodeURIComponent(infoText || lab)}')" title="Klik untuk rincian ${lab}">
      <div class="psc-bar" style="background:${color};box-shadow:0 0 12px ${color}"></div>
      <div class="psc-head">
        <span class="psc-icon" style="color:${color}">${iconSvg}</span>
        <span class="psc-label">${lab}</span>
      </div>
      <div class="psc-body">
        <span class="psc-val" data-psc-val="${key}" style="color:${color}">${val}</span>
        ${sub ? `<span class="psc-sub" data-psc-sub="${key}">${sub}</span>` : ''}
      </div>
      <div class="psc-interactive-hint">INFO ↗</div>
      <span class="psc-corner tl"></span>
      <span class="psc-corner br"></span>
    </div>`;

  const spm=playerSpeedMult(), swm=weatherSpeedMult();
  const eff=Math.min(spm*swm,RNG_ROLL_MAX_MULT);
  const pfStats=document.getElementById("pfStats");
  const playSec=Math.floor(state.playSec||0);
  const fmtPlay=()=>{const h=Math.floor(playSec/3600),m=Math.floor(playSec%3600/60);return h>0?`${h}j ${m}m`:m>0?`${m}m ${playSec%60}s`:`${playSec}s`;};
  /* RAREST POOL: kartu paling langka = "1 in N" TERBESAR di antara yang DIMILIKI pemain. */
  const _Kc=rollCommonScale();
  let rarest=null, rarestCh=-Infinity;
  for(const s of (state.stacks||[])){
    const c=CARDS[s.char]; if(!c)continue;
    const den=(c.chance||chanceOf(c.tier))*(s.shiny?SHINY_CHANCE_MULT:1)*(MUT_CHANCE_MULT[s.mut||"none"]||1);
    const ch=den>=ROLL_RARE_DEN?den:den/_Kc;
    if(ch>rarestCh){rarestCh=ch;rarest=s;}
  }

  const icPower = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
  const icLuck = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>`;
  const icSpeed = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>`;
  const icTime = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const icRolls = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  const icRarest = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`;

  const statsHtml = 
    statCard("power", "BATTLE POWER", fmt(totalPower()), icPower, "#fbbf24", "OPERATOR RATING", `BATTLE POWER: ${fmt(totalPower())} — Total kekuatan tempur kartu aktif + dek + artefak.`)
    +statCard("luck", "CURRENT LUCK", totalLuck().toFixed(1)+"×", icLuck, "#38bdf8", "ROLL PROBABILITY", `CURRENT LUCK: ${totalLuck().toFixed(1)}× — Pengganda peluang mendapatkan kartu langka.`)
    +statCard("speed", "ROLL SPEED", eff.toFixed(1)+"×", icSpeed, "#34d399", "CYCLE TEMPO", `ROLL SPEED: ${eff.toFixed(1)}× — Kecepatan perputaran auto-roll dan summon.`)
    +statCard("time", "WAKTU BERMAIN", fmtPlay(), icTime, "#c084fc", "SESSION ARCHIVE", `WAKTU BERMAIN: ${fmtPlay()} — Akumulasi waktu operasional akun.`)
    +statCard("rolls", "TOTAL ROLL", fmt(state.totalRolls||0), icRolls, "#f472b6", "LIFETIME SUMMON", `TOTAL ROLL: ${fmt(state.totalRolls||0)} — Total pemanggilan kartu sepanjang masa.`)
    +statCard("rarest", "RAREST POOL", rarest ? cardName(rarest.char) : "—", icRarest, "#fb923c", rarest ? `1 IN ${fmtChance(rarestCh)}` : "NO DATA", rarest ? `KARTU PALING LANGKA: ${cardName(rarest.char)} (1 IN ${fmtChance(rarestCh)})` : "Belum ada kartu langka yang dimiliki.");

  if(pfStats && !pfStats.querySelector('.psc-power')) {
    pfStats.innerHTML = statsHtml;
  }
  const pfPageStatsGrid = document.getElementById("pfPageStatsGrid");
  if(pfPageStatsGrid && !pfPageStatsGrid.querySelector('.psc-power')) {
    pfPageStatsGrid.innerHTML = statsHtml;
  }
  updateProfileLiveNumbers();

  const pfStatsBreakdown = document.getElementById("pfStatsBreakdown");
  if(pfStatsBreakdown && !pfStatsBreakdown.dataset.rendered) {
    pfStatsBreakdown.dataset.rendered = "1";
    pfStatsBreakdown.innerHTML = `
      <div class="prof-breakdown-card">
        <div class="pbc-title">FORMULA BATTLE POWER</div>
        <div class="pbc-desc">Dihitung dari kombinasi Base ATK + HP kartu utama yang dipasang di dek, bonus mutasi (Gold/Rainbow/Secret/Ultima), serta boost persentase artefak &amp; pet.</div>
      </div>
      <div class="prof-breakdown-card">
        <div class="pbc-title">ALGORITMA LUCK &amp; GACHA PROBABILITY</div>
        <div class="pbc-desc">Total Luck = Base (1.0) × Pet Multiplier × Weather Machine × Buff Potion. Setiap kelipatan 1.0× meningkatkan frekuensi kemunculan kartu tier Legendary &amp; Mythic.</div>
      </div>
    `;
  }

  /* ===== PARTY: pet + 2 artefak + kartu utama (portrait + pill) ===== */
  const pslot=(img,label,pill,name,slotKind,clickAction,hoverKind)=>`<div class="prof-slot${img?"":" empty"}" data-slot="${slotKind||""}" ${hoverKind?`data-hover="${hoverKind}"`:""} title="${name}" ${clickAction?`onclick="${clickAction}" style="cursor:pointer"`:""} role="button" tabindex="0">${img?`<img src="${thumbSrc(img)}" alt="" loading="lazy" decoding="async">`:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>'}<span class="ps-lab">${label}</span><span class="ps-pill">${pill}</span></div>`;
  const pd=state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;
  const slots=[];
  slots.push(pslot(
    pd?(pd.img||`assets/pets/${pd.id}.png`):"",
    "PET",
    pd?`+${pd.flat||0}${pd.pct?" / +"+Math.round(pd.pct)+"%":""}`:"KOSONG",
    pd?pd.name:"Pet kosong — klik untuk pasang",
    "pet",
    "if(typeof sfx!==\"undefined\"&&sfx.hit)sfx.hit();closeProfileModal();if(typeof toggleBackpack===\"function\"){toggleBackpack();if(typeof bpSetTab===\"function\")bpSetTab(\"pet\");}"
  ));
  [0,1].forEach(i=>{
    const aid=state.artSlots&&state.artSlots[i];
    const ad=aid?ART_DEFS.find(x=>x.id===aid):null;
    slots.push(pslot(
      ad?(ad.img||""):"",
      "ARTEFAK "+(i+1),
      ad?`+${ad.flat||0}${ad.pct?" / +"+ad.pct+"%":""}`:"KOSONG",
      ad?ad.name:"Artefak kosong — klik untuk pasang",
      "artefact",
      "if(typeof sfx!==\"undefined\"&&sfx.hit)sfx.hit();closeProfileModal();if(typeof toggleBackpack===\"function\"){toggleBackpack();if(typeof bpSetTab===\"function\")bpSetTab(\"artefact\");}"
    ));
  });
  slots.push(pslot(
    cid?cardImg(cid):"",
    "KARTU",
    cid?`1 IN ${fmtChance(effChance(cid,eq.mut||"none",!!eq.shiny))}`:"KOSONG",
    cid?cardName(cid):"Tanpa kartu — klik untuk ganti",
    "card",
    "if(typeof sfx!==\"undefined\"&&sfx.hit)sfx.hit();closeProfileModal();if(typeof toggleBackpack===\"function\"){toggleBackpack();if(typeof bpSetTab===\"function\")bpSetTab(\"deck\");}",
    "card"
  ));
  const partyKey=[
    state.petEquipped||'none',
    (state.artSlots&&state.artSlots[0])||'none',
    (state.artSlots&&state.artSlots[1])||'none',
    cid||'none',
    eq?(eq.mut||'none'):'',
    eq?(eq.trait||'none'):'',
    eq&&eq.shiny?'1':'0'
  ].join('|');
  const pfParty=document.getElementById("pfParty");
  if(pfParty&&pfParty.dataset.partyKey!==partyKey){
    pfParty.dataset.partyKey=partyKey;
    pfParty.innerHTML=slots.join("");
  }
  profHoverBind();
  /* ===== PANEL SAMPING: koleksi, progres, gear, item ===== */
  const tile=(lab,val,sub,tcls,vcls,oc)=>`<div class="prof-tile${tcls?" "+tcls:""}"${oc?` onclick="${oc}" style="cursor:pointer"`:""}><span class="prof-tl">${lab}</span><span class="prof-tv${vcls?" "+vcls:""}">${val}</span>${sub?`<span class="prof-ts">${sub}</span>`:""}</div>`;
  const st=Array.isArray(state.stacks)?state.stacks:[];
  let copies=0, shiny=0, gold=0, rainbow=0, secret=0, ultima=0; const uni=new Set();
  for(const s of st){const c=s.count||1;copies+=c;uni.add(s.char);
    if(s.shiny)shiny+=c;const m=s.mut||"none";
    if(m==="gold")gold+=c;else if(m==="rainbow")rainbow+=c;else if(m==="secret")secret+=c;else if(m==="ultima")ultima+=c;}
  const totalCards=MASTER_CARD_INDEX.filter(c=>!c.isStoryEnemy).length;
  const koleksi=
    tile("KARTU UNIK",`${uni.size} / ${totalCards}`,"")
    +tile("TOTAL COPY",fmt(copies),"")
    +tile("SHINY",fmt(shiny),"")
    +tile("GOLD",fmt(gold),"")
    +tile("RAINBOW",fmt(rainbow),"")
    +tile("SECRET",fmt(secret),"")
    +tile("ULTIMA",fmt(ultima),"");
  const cd=(state.clearedDiff&&typeof state.clearedDiff==="object")?state.clearedDiff:{};
  const storyTiles=DIFFS.map(d=>{const n=Object.keys(cd[d.k]||{}).length;
    return tile("STORY "+d.l,`${n}/${LEVEL_COUNT}`,"");}).join("");
  const raidDone=(state.raidCleared&&Object.values(state.raidCleared).some(Boolean))?1:0;
  /* Pool & attempt per boss (2 pool terpisah) — tile dibuat ringkas, TANPA "wide". */
  const wbVals=i=>(typeof wbPoolVals==="function")?wbPoolVals(i):{pool:1e12,left:1e12};
  const wbAttN=i=>(typeof wbAttOf==="function")?(wbAttOf(i)==null?0:wbAttOf(i)):3;
  const wbHP=i=>(typeof fmtBig==="function"?fmtBig(wbVals(i).left):"—")+" HP";
  const di=state.dailyIndex||0;
  const progres=
    tile("INFINITE TOWER",`Lantai ${(state.tower&&state.tower.best)||0}`,"")
    +tile("SKILL POINT",`${p.sp||0}`,"")
    +tile("HADIAH HARIAN",`HARI ${di+1} / 7`, (typeof DAILY_PACKS_100K!=="undefined"&&DAILY_PACKS_100K[di]!=null)?`KLAIM · +${DAILY_PACKS_100K[di]}× PACK 100K · +${DAILY_GEMS[di]||0} GEM`:"", "", "", "openDaily()")
    +storyTiles
    +tile("DRAGON",wbHP(0),`WORLD BOSS · ${wbAttN(0)}/3 ATTEMPT`)
    +tile("SHADOW KING",wbHP(1),`WORLD BOSS · ${wbAttN(1)}/3 ATTEMPT`);
  const gacha=
    tile("BATTLE SPEED",battleSpeedEff()+"×","")
    +tile("TOTAL SUMMON",fmt(state.summons||0),"");
  const artTile=i=>{const id=state.artSlots&&state.artSlots[i];
    const d=id?ART_DEFS.find(x=>x.id===id):null;
    return tile("ARTEFAK "+(i+1),d?d.name:"KOSONG","");};
  const gearStats=d=>`+${d.flat||0}${d.pct?" / +"+d.pct+"%":""}`;
  const ownedArt=ART_DEFS.filter(d=>(state.artOwned||[]).includes(d.id))
    .map(d=>{const on=(state.artSlots||[]).includes(d.id);return tile(d.name,on?"TERPASANG":"DIMILIKI",gearStats(d),on?"accent":"");}).join("");
  const ownedPet=PET_DEFS.filter(d=>(state.petOwned||[]).includes(d.id))
    .map(d=>{const on=state.petEquipped===d.id;return tile(d.name,on?"TERPASANG":"DIMILIKI",gearStats(d),on?"accent":"");}).join("");
  const equipCounts=
    tile("ARTEFAK DIMILIKI",`${(state.artOwned||[]).length} / ${ART_DEFS.length}`,"")
    +tile("PET DIMILIKI",`${(state.petOwned||[]).length} / ${PET_DEFS.length}`,"");
  const wAct=(state.weather&&Date.now()<state.weather.endsAt)?WEATHER[state.weather.id]:null;
  const luckPotN=(state.luckPots||[]).reduce((a,b)=>a+(b||0),0);
  const speedPotN=(state.speedPots||[]).reduce((a,b)=>a+(b||0),0);
  const item=
    tile("COIN",fmt(state.coins||0),"")
    +tile("TOKEN WORLD BOSS",fmt(state.wbTokens||0),"")
    +tile("TOKEN INF",fmt(state.infTokens||0),"")
    +tile("WEATHER POTION",`×${state.potions||0}`,"")
    +tile("MYTHIC POTION",`×${state.mythicPotions||0}`,"")
    +tile("LUCK POTION",`×${fmt(luckPotN)}`,"")
    +tile("SPEED POTION",`×${fmt(speedPotN)}`,"")
    +tile("CUACA AKTIF",wAct?`<span style="display:inline-flex;align-items:center;gap:6px;color:${wAct.color}">${weatherSvg(wAct.id,16)} ${wAct.name}</span>`:"TIDAK AKTIF","","wide")
    +tile("BUFF AKTIF",(activeLuckBuff()>0||activeSpeedBuff()>0)?"AKTIF":"TIDAK AKTIF","","wide");
  const titles=[
    {n:"ROOKIE ROLLER",d:"Roll kartu pertama",ok:(state.summons||0)>=1},
    {n:"COLLECTOR",d:"Kumpulkan 10 kartu unik",ok:uni.size>=10},
    {n:"SHINY HUNTER",d:"Dapatkan 1 kartu shiny",ok:shiny>=1},
    {n:"TOWER CLIMBER",d:"Capai lantai 10 Infinite Tower",ok:((state.tower&&state.tower.best)||0)>=10},
    {n:"RAID SLAYER",d:"Kalahkan 1 boss raid",ok:raidDone>=1},
    {n:"ELITE",d:"Capai level 25",ok:lv>=25}
  ];
  const titlesGrid=titles.map(t=>tile(t.n,t.ok?"✓ DIRAIH":"· belum",t.d,t.ok?"accent":"",t.ok?"prof-ok":"","openTitlesModal()")).join("");
  const earned=titles.filter(t=>t.ok);
  const sec=(t,grid)=>`<section class="prof-sec"><h3 class="prof-sec-t">${t}</h3><div class="prof-grid">${grid}</div></section>`;
  const kolPct=Math.round(uni.size/Math.max(1,totalCards)*100);
  const fill=(id,html,key)=>{
    const el=document.getElementById(id);
    if(!el)return;
    if(key!=null && el.dataset.renderedKey===key)return;
    if(key!=null) el.dataset.renderedKey=key;
    el.innerHTML=html;
  };
  const achieveKey = [earned.length, titles.length, ...earned.map(t=>t.n)].join('|');
  fill("pfAchieve",earned.length
    ?tile("TITLE DIRAIH",`${earned.length} / ${titles.length}`,"Klik untuk kelola title","accent","","profTabGo('achievements')")+earned.map(t=>tile(t.n,"✓ DIRAIH",t.d,"accent","prof-ok","openTitlesModal()")).join("")
    :tile("BELUM ADA TITLE","·","Selesaikan misi awal untuk membuka pencapaian","wide","","openTitlesModal()"), achieveKey);
  fill("pfPageAchieveGrid", titlesGrid, achieveKey);
  const kolKey = [uni.size, totalCards, copies, shiny, gold, rainbow, secret, ultima].join('|');
  fill("pfPageKoleksi",
    `<div class="prof-kbar"><i style="width:${kolPct}%"></i><span>${uni.size} / ${totalCards} KARTU · ${kolPct}%</span></div>`
    +sec("KOLEKSI KARTU",koleksi)
    +sec("GACHA",gacha), kolKey);
  const progKey = [(state.tower&&state.tower.best)||0, p.sp||0, di, Object.keys(cd).length].join('|');
  fill("pfPageProgres",`<div class="prof-grid">${progres}</div>`, progKey);
  const eqKey = [partyKey, (state.artOwned||[]).length, (state.petOwned||[]).length].join('|');
  fill("pfPageEkuipmen",
    sec("TERPASANG",artTile(0)+artTile(1)+tile("PET",pd?pd.name:"TIDAK ADA","")+equipCounts)
    +sec("INVENTORY ARTEFAK",ownedArt||tile("BELUM ADA ARTEFAK","·","Beli di toko untuk membuka slot","wide"))
    +sec("INVENTORY PET",ownedPet||tile("BELUM ADA PET","·","Dapatkan pet dari raid / tower","wide")), eqKey);
  const itemKey = [state.coins||0, state.wbTokens||0, state.infTokens||0, state.potions||0, state.mythicPotions||0, luckPotN, speedPotN, wAct?wAct.id:'none', activeLuckBuff(), activeSpeedBuff()].join('|');
  fill("pfPageItem",`<div class="prof-grid">${item}</div>`, itemKey);
  fill("pfPageTitles",`<div class="prof-grid">${titlesGrid}</div>`, achieveKey);
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
let bpSortMode = "baku"; /* urutan koleksi DECK (segmented URUTKAN): baku|baru|power|cuaca */
let bpTab = "deck"; /* tab Backpack: deck | item | artefact | pet */
function bpSetTab(t){bpTab=t;bpTarget=null;bpItemPopClose();renderBackpackPanel();}
/* nav.bp-tabs = satu baris + overflow-x:auto, jadi tab 04/05 bisa terlipat di luar layar.
   Pusatkan tab aktif HANYA kalau dia belum terlihat seluruhnya — kalau user sudah geser
   manual ke posisi yang masih memuat tab aktif, scrollLeft-nya jangan dilompat. */
function bpCenterActiveTab(){
  const nav=document.querySelector('.backpack-panel .bp-tabs')||document.querySelector('.bp-tabs');
  if(!nav)return;
  const tab=nav.querySelector('.bp-tab.on')||nav.firstElementChild;
  if(!tab)return;
  const nr=nav.getBoundingClientRect(),tr=tab.getBoundingClientRect();
  if(tr.width&&tr.left>=nr.left&&tr.right<=nr.right)return;
  nav.scrollLeft=tab.offsetLeft-(nav.clientWidth-tab.offsetWidth)/2;
}
function deckTotalPower(){return totalPower();} /* delegate ke totalPower() — satu sumber, sinkron selamanya */
function bpPickSlot(i){bpTarget=(bpTarget===i?null:i);renderBackpackPanel();}
function bpSetFilter(m){bpMutFilter=m;renderBackpackPanel();}
function bpSetSort(k){bpSortMode=k;renderBackpackPanel();}
/* POWER varian = HP+ATK sesudah pengali mutasi/shiny/trait (cardStats) — satu rumus utk slot, tile, dan meter daya. */
function bpPowerOf(s){const st=cardStats(s.char,s.mut,s.trait,s.shiny);return st.hp+st.atk;}
function bpMutCountOf(m){return state.stacks.filter(s=>m==='all'?true:(m==='shiny'?!!s.shiny:(s.mut||'none')===m)).length;}
/* cuaca kartu = kepemilikan asli CARDS[char].weatherOnly (sumber: MASTER_CARD_INDEX/STORY_BIBLE), bukan tebakan */
function bpWeatherOf(s){const c=CARDS[s.char];const id=c&&c.weatherOnly;return id?(WEATHER[id]||null):null;}
/* rank ikut weatherRank() asli (dropWeight ASC, paling langka = 0); 99 = bukan kartu cuaca -> nyangkut di belakang */
function bpWeatherRankOf(s){const w=bpWeatherOf(s);return w?weatherRank(w.id):99;}
/* state.stacks di-push tiap roll (js/panels.js:674) => ekor array = varian paling BARU; 12 terakhir = "baru". */
let _bpNewIds=null,_bpNewKey="";
function bpIsNew(s){const st=state.stacks,n=st.length,key=n+":"+(n?st[n-1].id:"");if(key!==_bpNewKey){_bpNewKey=key;_bpNewIds=new Set(st.slice(Math.max(0,n-12)).map(x=>x.id));}return _bpNewIds.has(s.id);}
function bpInDeck(s){return state.deck.includes(s.id);}
/* BAKU = rantai sort lama (sebelumnya inline di renderBackpackPanel) — urutan default, jangan diubah tanpa ACC user. */
function bpCompareBaku(a,b){return (bpInDeck(b)?1:0)-(bpInDeck(a)?1:0)||(b.fav?1:0)-(a.fav?1:0)||bpPowerOf(b)-bpPowerOf(a)||luckChance(b.char,b.mut,b.shiny)-luckChance(a.char,a.mut,a.shiny);}
/* daftar koleksi tersaring (bpMatchesMut) + terurut sesuai bpSortMode; BARU = posisi stack paling ekor dulu. */
function bpSortedStacks(){
  const list=state.stacks.filter(bpMatchesMut);
  if(bpSortMode==="baru"){const pos=new Map();state.stacks.forEach((s,i)=>pos.set(s.id,i));list.sort((a,b)=>((pos.get(b.id)||0)-(pos.get(a.id)||0))||bpCompareBaku(a,b));}
  else if(bpSortMode==="power"){list.sort((a,b)=>bpPowerOf(b)-bpPowerOf(a)||bpCompareBaku(a,b));}
  else if(bpSortMode==="cuaca"){list.sort((a,b)=>bpWeatherRankOf(a)-bpWeatherRankOf(b)||bpCompareBaku(a,b));}
  else{list.sort(bpCompareBaku);}
  return list;
}
/* porsi daya tile = bpPowerOf(s) / max daya list yang lagi tampil (0..1); floor --pw prototipe (0.035) urusan markup. */
function bpPowerNorm(s,list){let mx=0;if(Array.isArray(list))for(let i=0;i<list.length;i++){const p=bpPowerOf(list[i]);if(p>mx)mx=p;}if(mx<=0)return 0;const r=bpPowerOf(s)/mx;return r<0?0:(r>1?1:r);}
function bpMatchesMut(s){return bpMutFilter==="all"||(bpMutFilter==="shiny"?!!s.shiny:(s.mut||"none")===bpMutFilter);}
function bpCardBorderColor(s){if(s.mut&&s.mut!=="none"&&MUT_COLOR[s.mut])return MUT_COLOR[s.mut];if(s.shiny)return "#7DF9FF";return "var(--line2)";}
function bpCardBorderKind(s){if(s.shiny&&s.mut&&s.mut!=="none"&&MUT_COLOR[s.mut])return "shiny-"+s.mut;if(s.mut&&s.mut!=="none"&&MUT_COLOR[s.mut])return s.mut;if(s.shiny)return "shiny";return "";}
function bpClearSlot(i){setDeckSlot(i,null);bpTarget=null;renderBackpackPanel();if(!battleLive()&&typeof render==="function")render();}
function bpAssign(stackId){
  const s=state.stacks.find(x=>x.id===stackId);if(!s)return;
  let slot=bpTarget;
  if(slot==null)slot=state.deck.indexOf(null);
  if(slot<0)slot=0;                 /* dek penuh: timpa slot pertama */
  setDeckSlot(slot,s.id);
  bpTarget=null;
  renderBackpackPanel();
  if(!battleLive()&&typeof render==="function")render();
}
function bpFav(stackId){const s=state.stacks.find(x=>x.id===stackId);if(!s)return;s.fav=!s.fav;save();renderBackpackPanel();}
function bpLock(stackId){const s=state.stacks.find(x=>x.id===stackId);if(!s)return;s.lock=!s.lock;save();renderBackpackPanel();}
/* ---- LAZY-MOUNT grid kartu: kartu di luar layar tidak dibangun DOM-nya (mount-on-scroll) ----
   Dipakai koleksi DECK, picker BOSS RAID, INDEX, dan picker KARTU. rootEl = elemen yang di-scroll. */
var _bpTileHtml={};
function lazyMountGrid(rootEl,htmlMap,opts){
  if(!rootEl)return;
  opts=opts||{};
  if(rootEl.__lzIO){try{rootEl.__lzIO.disconnect();}catch(e){}rootEl.__lzIO=null;}
  const phs=[].slice.call(rootEl.querySelectorAll('.lz-ph'));
  if(!phs.length)return;
  const fill=el=>{if(!el.classList.contains('lz-ph'))return;const k=el.getAttribute('data-lz');el.innerHTML=(htmlMap[k]!=null?htmlMap[k]:'');el.classList.remove('lz-ph');};
  if(!('IntersectionObserver'in window)){phs.forEach(fill);return;}
  const io=new IntersectionObserver(entries=>{
    entries.forEach(en=>{if(en.isIntersecting){fill(en.target);io.unobserve(en.target);}});
  },{root:rootEl,rootMargin:(opts.prefetch||300)+'px 0px'});
  rootEl.__lzIO=io;
  phs.forEach(el=>io.observe(el));
}
/* TILE prototipe (v3 .tile): TANPA TEKS — art + chip tier + bintang fav + glif mut/shiny +
   mark cuaca + dot BARU + meter power + dot equipped. Nilai lewat CSS custom property di
   container (--pw/--tcol/--mcol/--wcol, lihat builder deck) supaya ui-css cukup membaca. */
function bpTileInner(s){
  if(!s||!s.char||!CARDS[s.char]) return '';
  const cData=CARDS[s.char];
  const tier=cData.tier||'COMMON';
  const st=cardStats(s.char,s.mut,s.trait,s.shiny);
  const mut=(s.mut&&s.mut!=='none')?s.mut:null;
  const trait=(s.trait&&s.trait!=='none')?s.trait:null;
  const cName=cardName(s.char);
  const w=bpWeatherOf(s);
  const chanceText=rarityText(tier,luckChance(s.char,s.mut,s.shiny));
  const fav=s.fav?`<svg class="bpt-fav" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${BP_STAR_PATH}"/></svg>`:'';

  const chanceSpan=`<span class="hc-chance bpt-chance${mut==='rainbow'?' hc-chance-rainbow':''}" style="background:none !important;border:none !important;box-shadow:none !important;padding:0 !important;border-radius:0 !important;transform:none !important;text-shadow:0 1px 3px rgba(0,0,0,0.95), 0 0 2px #000 !important;color:${mut?MUT_COLOR[mut]:((tier&&TIER_COLOR[tier])||"#9AA6B2")}">${mut==='rainbow'?mutText(mut,chanceText):chanceText}</span>`;

  const badgesHtml=trait
    ?`<div class="hc-badges bpt-top">${traitChip(trait,`<span class="hc-trait hc-gem bpt-gem" style="color:${TRAIT_COLOR[trait]};border-color:${TRAIT_COLOR[trait]}">${traitGem(12,trait)}</span>`)}</div>`
    :'';

  const bcol = mut ? MUT_COLOR[mut] : ((tier && TIER_COLOR[tier]) || '#7DF9FF');
  return `<div class="hub-center bp-card-hub${cData.fullArt?' fa':''}${mut?' mut-'+mut:''}${shinyCls(s)}" data-tier="${tier}" style="--tcol:${bcol};border:3px solid ${bcol};border-radius:1px;box-sizing:border-box;width:100%;height:100%;aspect-ratio:inherit;overflow:hidden;position:relative;">
      <div class="hc-img" style="position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit;">
        <img src="${cardThumb(s.char)}" alt="${cName}" width="360" height="536" loading="lazy" decoding="async"${cData.pos?` style="object-position:${cData.pos}"`:''}>
        ${chanceSpan}
        ${badgesHtml}
        ${fav}
        ${w?`<span class="bpt-w" style="color:${w.color}">${weatherSvg(w.id,13)}</span>`:''}
        ${bpIsNew(s)?'<span class="bpt-ndot" aria-hidden="true"></span>':''}
      </div>
      <div class="hc-info">
        <div class="hc-stats bpt-stats">
          <div class="hp"><i>HP</i> <b>${fmtStat(st.hp)}</b></div>
          <div class="atk"><i>ATK</i> <b>${fmtStat(st.atk)}</b></div>
        </div>
      </div>
      <span class="bpt-pw" aria-hidden="true"></span>
      ${bpInDeck(s)?'<span class="bpt-eqdot" aria-hidden="true"></span>':''}
    </div>`;
}
function bpLazyMountTiles(){
  lazyMountGrid(document.querySelector('.bp-scroll'),_bpTileHtml);
}
function renderBackpackPanel(){
  const panel=document.getElementById('backpackPanel');if(!panel)return;
  bpsHoverBind();bpsHoverHide();
  /* guard anti-menggantung (kontrak): re-render ke tab lain / koleksi kosong = tutup popover+modal */
  if(bpTab!=='deck'||!state.stacks.length){bpCardModalClose();_bpMutPopOpen=false;}
  if(bpTab!=='tree'){bpTreeDetailClose();} /* pindah tab = detail skill tree ikut hilang */
  const TABS=[
    {k:'deck',num:'01',l:'DECK MATRIX',ic:`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`},
    {k:'tree',num:'02',l:'SKILL TREE',ic:`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="17.07" x2="10.41" y2="7.93"/><line x1="15.41" y1="17.07" x2="13.59" y2="7.93"/></svg>`},
    {k:'item',num:'03',l:'POTION & ITEMS',ic:`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>`},
    {k:'artefact',num:'04',l:'ARTEFACTS',ic:`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`},
    {k:'pet',num:'05',l:'COMPANION PETS',ic:`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/><path d="M9.5 12l1.8 1.8L15 10"/></svg>`}
  ];
  const tabbar=`<nav class="bp-tabs" role="tablist">${TABS.map(t=>`<button class="bp-tab${bpTab===t.k?' on':''}" onclick="if(typeof sfx!=='undefined'&&sfx.click)sfx.click();bpSetTab('${t.k}')" role="tab" aria-selected="${bpTab===t.k}"><span class="bp-tab-num">${t.num}</span><span class="bp-tab-ic">${t.ic}</span><span class="bp-tab-l">${t.l}</span><span class="bp-tab-laser"></span></button>`).join('')}</nav>`;
  queueMicrotask(bpCenterActiveTab);
  /* HEADER prototipe v3 (locked, _tmp/proto_backpack_v3.html 20-27): wordmark + accent rule + 2 stat REAL.
     KARTU = state.stacks.length (sumber sama seperti "KOLEKSI n" di bar DECK), POWER = deckTotalPower()
     via fmt() (formatter angka besar backpack, tabular-nums + nowrap supaya tidak kepotong tengah digit).
     Tombol tutup + identitas operator DIPERTAHANKAN (data hidup), ditaruh di kanan setelah stat.
     Pill koin + luck DIHAPUS dari header (permintaan user) — kelas .bph-stats/.bph-stat-pill tidak
     di-emit lagi; .bph-left/.bph-eyebrow/.bph-title/.bph-dot/.bph-sys/.bph-code juga tidak. */
  const _bpPower=(typeof deckTotalPower==='function'?deckTotalPower():0);
  const header=`<div class="backpack-header">
    <div class="bp-wordmark">BACKPACK<small>SQUADRON COMMAND</small></div>
    <div class="bp-hdr-line" aria-hidden="true"></div>
    <div class="bp-hdr-stats">
      <div class="bp-hstat"><div class="bp-hstat-k">KARTU</div><div class="bp-hstat-v">${fmt(state.stacks.length)}</div></div>
      <div class="bp-hstat"><div class="bp-hstat-k">POWER</div><div class="bp-hstat-v am">${fmt(_bpPower)}</div></div>
    </div>
    <div class="bph-right">
      <button class="backpack-close" onclick="toggleBackpack()" aria-label="Tutup Backpack" title="Tutup [ESC]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  </div>${tabbar}`;

  if(bpTab==='tree'){panel.innerHTML=header+`<div class="bp-body tree">${renderBpTree()}</div>`;stMount();bpTreeDetailSync();return;}
  if(bpTab==='item'){panel.innerHTML=header+`<div class="bp-body">${renderBpItems()}</div>`;return;}
  if(bpTab==='artefact'){panel.innerHTML=header+`<div class="bp-body">${renderBpArts()}</div>`;return;}
  if(bpTab==='pet'){panel.innerHTML=header+`<div class="bp-body">${renderBpPets()}</div>`;return;}

  /* tab DECK (default) */
  if(!state.stacks.length){panel.innerHTML=header+`<div class="bp-empty">Belum punya kartu. Tekan ROLL untuk mendapatkan kartu.</div>`;return;}

  /* RACK prototipe (v3 .conduit .slot): 4 slot vertikal rata — TANPA role text, TANPA nama
     kartu di slot terisi (keputusan user). Nama hanya lewat aria-label. Kosong = frame
     minimal + "+" SVG. Kelas .bps-* dipertahankan supaya CSS lama tetap.anchor. */
  const slots=[0,1,2,3].map(i=>{
    const id=state.deck[i];const s=id?state.stacks.find(x=>x.id===id):null;
    if(!s)return `
      <div class="bp-slot empty${bpTarget===i?' sel':''}" onclick="bpPickSlot(${i})" title="Pilih Slot ${i+1}" aria-label="Slot ${i+1} kosong">
        <div class="bps-empty-body">
          <div class="bps-plus-circle"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg></div>
        </div>
        <span class="bps-num" aria-hidden="true">0${i+1}</span>
        <span class="bps-corner tl"></span>
        <span class="bps-corner br"></span>
      </div>`;
    const edge=bpCardBorderColor(s),variant=bpCardBorderKind(s),variantClass=variant?" bp-mut-"+variant:"",edgeStyle=variant?"":";border-color:"+edge;
    const mutCls=(s.mut&&s.mut!=='none')?' mut-'+s.mut:'';
    const shinyClsStr=s.shiny?' shiny':'';
    const fullMutClass=variantClass+mutCls+shinyClsStr;
    return `
      <div class="bp-slot filled${bpTarget===i?' sel':''}${fullMutClass}${CARDS[s.char]&&CARDS[s.char].fullArt?' fa':''}" data-sid="${s.id}" onclick="bpPickSlot(${i})" aria-label="Slot ${i+1}: ${cardName(s.char)}" style="--tcol:${edge}${edgeStyle}">
        <div class="bps-art-wrap">
          <img src="${cardThumb(s.char)}" alt="" loading="lazy" decoding="async">
        </div>
        <span class="bps-num" aria-hidden="true">0${i+1}</span>
        <button class="bps-x" onclick="event.stopPropagation();bpClearSlot(${i})" title="Lepas Kartu" aria-label="Lepas kartu dari slot ${i+1}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
        <span class="bps-corner tl"></span>
        <span class="bps-corner br"></span>
      </div>`;
  }).join('');

  const _vis0=bpSortedStacks();
  const visible=bpFavOnly?_vis0.filter(s=>s.fav):_vis0; /* FAV-only hanya berlaku di tab DECK (desain prototipe) */
  const INITIAL=48;
  _bpTileHtml={};
  const tiles=visible.map((s,i)=>{
    _bpTileHtml[s.id]=bpTileInner(s);
    const cData=CARDS[s.char];
    const tier=(cData&&cData.tier)||'COMMON';
    const mut=(s.mut&&s.mut!=='none')?s.mut:null;
    const w=bpWeatherOf(s);
    const pw=Math.max(0.035,bpPowerNorm(s,visible)); /* floor 0.035 prototipe — meter tak pernah hilang total */
    const nm=cardName(s.char);
    const mounted=i<INITIAL;
    const mcol=mut?(MUT_COLOR[mut]||'#7DF9FF'):'#7DF9FF'; /* shiny-only juga #7DF9FF, sama seperti bpCardBorderColor */
    return `<div class="bp-tile${bpInDeck(s)?' in-deck':''}${cData&&cData.fullArt?' fa':''}${mounted?'':' lz-ph'}" data-lz="${s.id}" data-sid="${s.id}" data-name="${nm.toLowerCase()}" aria-label="${nm}" role="button" onclick="bpCardModalOpen('${s.id}')" style="border:none !important;box-shadow:none !important;background:transparent !important;padding:0 !important;outline:none !important;--pw:${pw.toFixed(3)};--tcol:${(cData&&TIER_COLOR[tier])||'#94a3b8'};--mcol:${mcol};--wcol:${w?w.color:'transparent'}">${mounted?_bpTileHtml[s.id]:''}</div>`;
  }).join('');
  /* COLLECTION BAR prototipe (v3 .coll-bar): KOLEKSI n + FAV + MUT(popover: baris mutasi + URUTKAN) + search.
     URUTKAN sengaja DI DALAM popover (prototipe v3) — 4 tombol di bar memecah bar jadi 2-5 baris
     di 320-390px dan meruntuhkan grid jadi ~1 kolom.
     Bar = anak PERTAMA .bp-collect, di atas .bp-scroll: di HP bar mengambil ruang dari grid,
     grid tetap scrollable (posisi baru; .bp-colhead "CARD ARCHIVE // VAULT" diganti KOLEKSI). */
  const rows=BP_MUT_KEYS.map(k=>`<button class="bp-mrow${bpMutFilter===k?' on':''}" onclick="event.stopPropagation();bpMutPick('${k}')" aria-pressed="${bpMutFilter===k}" style="--mc:${BP_MUT_COLORS[k]}"><span class="bp-mrow-sw">${BP_MUT_SWATCH(k)}</span><span class="bp-mrow-lb">${BP_MUT_NAMES[k]}</span><b class="bp-mrow-cn">${bpMutCountOf(k)}</b></button>`).join('');
  /* PROTOTIPE v3: URUTKAN ada DI DALAM popover MUT (bukan di bar) supaya bar satu baris di 320-390px.
     onclick pakai event.stopPropagation() — sama seperti .bp-mrow: re-render melepas node lama,
     tanpa itu listener klik-luar menutup popover tepat setelah memilih sort. */
  const seg=BP_SORT_KEYS.map(k=>`<button class="bp-sbtn${bpSortMode===k?' on':''}" onclick="event.stopPropagation();bpSetSort('${k}')" aria-pressed="${bpSortMode===k}">${BP_SORT_NAMES[k]}</button>`).join('');
  const pop=_bpMutPopOpen?`<div class="bp-mutpop" id="bpMutPop" role="group" aria-label="Penyaring mutasi koleksi"><div class="bp-pop-h">MUTASI</div><div class="bp-pop-list">${rows}</div><div class="bp-pop-h">URUTKAN</div><div class="bp-seg" role="group" aria-label="Urutkan koleksi">${seg}</div></div>`:'';
  const searchInput=`<input id="bp-search" class="bp-search" type="search" placeholder="Cari kartu / mutasi..." value="${deckSearch}" oninput="deckSearch=this.value;runCardSearch(this,document.querySelector('.bp-tiles'),document.getElementById('bp-nores'))">`;
  const filterRow=`<div class="bp-filter">
      <span class="bp-kol">KOLEKSI <b class="bp-kol-n">${visible.length}</b></span>
      <button class="bp-favtog${bpFavOnly?' on':''}" onclick="bpSetFavOnly()" aria-pressed="${bpFavOnly}" title="Hanya kartu favorit"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${BP_STAR_PATH}"/></svg><span>FAV</span></button>
      <button class="bp-mutbtn${bpMutFilter!=='all'?' on':''}" id="bp-mutbtn" onclick="event.stopPropagation();bpMutPopToggle()" aria-expanded="${_bpMutPopOpen}" aria-haspopup="true" aria-controls="bpMutPop" style="--mc:${BP_MUT_COLORS[bpMutFilter]}"><span class="bp-mb-glyph">${BP_MUT_SWATCH(bpMutFilter)}</span><span>MUT</span><svg class="bp-mb-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
      ${searchInput}
      ${pop}
    </div>`;
  panel.innerHTML=header+`<div class="bp-body deck"><div class="bp-cols">
    <div class="bp-deckcol">
      <div class="bp-col-head">
        <span class="bp-h">SQUADRON DECK</span>
        <span class="bp-deck-count">[ ${state.deck.filter(Boolean).length} / 4 ]</span>
      </div>
      <div class="bp-slots">${slots}</div>
      <div class="bp-deckmeta">
        <div class="bdm-core">
          <div class="bdm-label"><span class="bdm-dot"></span><span>SQUADRON COMBAT POWER</span></div>
          <div class="bdm-val-row">
            <b class="bdm-v">${fmt(deckTotalPower())}</b>
            <span class="bdm-tag">DEPLOYABLE</span>
          </div>
        </div>
        <button class="bp-save" onclick="if(typeof sfx!=='undefined'&&sfx.confirm)sfx.confirm();toast('DECK TERSIMPAN','SQUADRON SIAP TEMPUR','#7DF9FF')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>SIMPAN KONFIGURASI</span>
        </button>
      </div>
    </div>
    <div class="bp-collect">
      ${filterRow}
      ${visible.length?`<div class="bp-scroll"><div class="bp-tiles">${tiles}</div><div class="bp-empty" id="bp-nores" style="display:none;padding:18px 0">Kartu tidak ditemukan.</div></div>`:`<div class="bp-empty" style="padding:18px 0">Tidak ada kartu varian ini.</div>`}
    </div>
  </div></div>`;
  /* terapkan ulang query search setelah re-render (misal toggle ★) — query disimpan di deckSearch */
  const si=document.getElementById('bp-search');
  if(si&&deckSearch)runCardSearch(si,document.querySelector('.bp-tiles'),document.getElementById('bp-nores'));
  bpLazyMountTiles();
  bpCardModalSync(); /* modal di luar panel: disinkron in-place tiap re-render, tidak pernah dobel */
}
/* ===== DECK port step-2 (ui-ux): FAV-only + popover MUT + modal kartu (prototipe v3) =====
   Semua angka hanya lewat fungsi core step-1 (bpSortedStacks/bpMutCountOf/bpWeatherOf/
   bpIsNew/bpPowerNorm/bpPowerOf) — tidak ada perhitungan ulang di sini. */
let bpFavOnly=false;
let _bpMutPopOpen=false;
let _bpCardModalId=null;
const BP_STAR_PATH='M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z';
const BP_MUT_KEYS=['all','none','shiny','gold','rainbow','secret','ultima'];
const BP_MUT_NAMES={all:'SEMUA',none:'BIASA',shiny:'SHINY',gold:'GOLD',rainbow:'RAINBOW',secret:'SECRET',ultima:'ULTIMA'};
/* warna baris popover = prototipe colorOf(): all/none/shiny bukan MUT_COLOR, sisanya verbatim MUT_COLOR */
const BP_MUT_COLORS={all:'#8aa3bd',none:'#00d9ff',shiny:'#eaffff',gold:'#E0BC6E',rainbow:'#B58CFF',secret:'#A855F7',ultima:'#FF0055'};
const BP_SORT_KEYS=['baku','baru','power','cuaca'];
const BP_SORT_NAMES={baku:'BAKU',baru:'TERBARU',power:'POWER',cuaca:'CUACA'};
/* swatch non-teks per mutasi (prototipe swatchOf): garis=tua, lingkaran=BIASA, bintang=SHINY,
   bentuk gold/rainbow/secret/ultima = clip-path ui-css di .bp-glyph.g-<mut> */
function BP_MUT_SWATCH(k){
  if(k==='all')return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>';
  if(k==='none')return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="7.5"/></svg>';
  if(k==='shiny')return `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${BP_STAR_PATH}"/></svg>`;
  return `<i class="bp-glyph g-${k}"></i>`;
}
function bpSetFavOnly(){bpFavOnly=!bpFavOnly;renderBackpackPanel();}
function bpMutPopToggle(){_bpMutPopOpen=!_bpMutPopOpen;renderBackpackPanel();}
function bpMutPopClose(){if(!_bpMutPopOpen)return;_bpMutPopOpen=false;const p=document.getElementById('bpMutPop');if(p)p.remove();const b=document.getElementById('bp-mutbtn');if(b)b.setAttribute('aria-expanded','false');}
/* pilih filter dari popover: bpSetFilter re-render penuh; popover sengaja tetap terbuka
   (prototipe: count & aktif ikut ter-update) — klik luar / Esc menutup */
function bpMutPick(k){bpSetFilter(k);}
function bpCardModalOpen(id){_bpCardModalId=id;bpCardModalSync();}
function bpCardModalClose(){const e=document.getElementById('bpCardModal');if(e)e.remove();_bpCardModalId=null;}
/* Modal kartu (pengganti bpAssign langsung di tile). Elemen body-level ala bpItemPop:
   dibuat saat sync, dihapus saat close; re-render cukup sync ulang -> tak pernah duplikat. */
function bpCardModalSync(){
  if(!_bpCardModalId){bpCardModalClose();return;}
  const s=state.stacks.find(x=>x.id===_bpCardModalId);
  if(!s){bpCardModalClose();return;}
  let el=document.getElementById('bpCardModal');
  if(!el){
    el=document.createElement('div');el.id='bpCardModal';el.className='bp-cardmodal';
    el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
    el.addEventListener('click',ev=>{if(ev.target===el)bpCardModalClose();});
    document.body.appendChild(el);
  }
  const c=CARDS[s.char];
  const tier=(c&&c.tier)||'COMMON';
  const tCol=(c&&TIER_COLOR[tier])||'#94a3b8';
  const st=cardStats(s.char,s.mut,s.trait,s.shiny);
  const mut=(s.mut&&s.mut!=='none')?s.mut:null;
  const mcol=mut?(MUT_COLOR[mut]||'#7DF9FF'):(s.shiny?'#7DF9FF':tCol);
  const slot=state.deck.indexOf(s.id);
  const w=bpWeatherOf(s);
  el.setAttribute('aria-label',cardName(s.char));
  /* defect prototipe "13,3 / 00": angka besar patah dua baris -> fmtStat (compact) + nowrap di markup */
  const stat=(k,v,extra)=>`<div class="bp-cm-st"><span class="bp-cm-k">${k}</span><span class="bp-cm-v" style="white-space:nowrap${extra?';'+extra:''}">${v}</span></div>`;
  const mutLbl=(mut||s.shiny)?`<span class="bp-cm-mut" style="color:${mcol}">${s.shiny?'SHINY':''}${s.shiny&&mut?' · ':''}${mut?(MUT_LABEL[mut]||''):''}</span>`:'';
  el.innerHTML=`
    <div class="bp-cm-panel">
      <button class="bp-cm-x" onclick="bpCardModalClose()" aria-label="Tutup" title="Tutup [ESC]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
      <div class="bp-cm-top">
        <div class="bp-cm-art"><img src="${cardThumb(s.char)}" alt="${cardName(s.char)}" decoding="async"></div>
        <div class="bp-cm-info">
          <div class="bp-cm-name"${mut?` style="color:${MUT_COLOR[mut]||'#7DF9FF'}"`:''}>${cardName(s.char)}</div>
          ${w?`<span class="bp-cm-chip" style="color:${tCol}">${w.name}</span>`:''}
          ${mutLbl}
          <div class="bp-cm-stats">
            ${stat('ATK',fmtStat(st.atk))}
            ${stat('HP',fmtStat(st.hp))}
            ${stat('PELUANG',rarityText(tier,luckChance(s.char,s.mut,s.shiny)),'color:#9fb4cc')}
            ${stat('POWER',fmtStat(st.hp+st.atk),'color:'+mcol)}
          </div>
          <div class="bp-cm-own${slot>=0?' on':''}">${slot>=0?'DI DEK · SLOT '+(slot+1):'DIMILIKI'}</div>
        </div>
      </div>
      <div class="bp-cm-pass"><span class="bp-cm-k">PASSIVE</span><div class="bp-cm-skill">${c&&c.passive?c.passive.name:''}</div><p class="bp-cm-desc">${c&&c.passive?c.passive.desc:''}</p></div>
      <div class="bp-cm-acts">
        <button class="bp-cm-btn pri" onclick="bpAssign('${s.id}')">EQUIP</button>
        ${slot>=0?`<button class="bp-cm-btn warn" onclick="bpClearSlot(${slot})">UNEQUIP</button>`:''}
        <button class="bp-cm-btn gold${s.fav?' on':''}" onclick="bpFav('${s.id}')" aria-pressed="${!!s.fav}"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${BP_STAR_PATH}"/></svg><span>FAV</span></button>
        <button class="bp-cm-btn lockbtn${s.lock?' on':''}" onclick="bpLock('${s.id}')" aria-pressed="${!!s.lock}" title="${s.lock?'Buka kunci kartu':'Kunci kartu'}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg><span>LOCK</span></button>
      </div>
    </div>`;
}
/* Esc berjenjang (capture, sebelum boot.js menutup backpack): modal > popover > bawaan. */
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  if(document.getElementById('bpCardModal')){e.stopPropagation();e.preventDefault();bpCardModalClose();return;}
  if(document.getElementById('bpTreeDetail')){e.stopPropagation();e.preventDefault();bpTreeDetailClose();return;}
  if(_bpMutPopOpen){e.stopPropagation();bpMutPopClose();}
},true);
/* klik-luar menutup popover MUT (baris dlm popover sudah stopPropagation sendiri) */
document.addEventListener('click',function(e){
  if(!_bpMutPopOpen)return;
  const pop=document.getElementById('bpMutPop');if(pop&&pop.contains(e.target))return;
  const btn=document.getElementById('bp-mutbtn');if(btn&&btn.contains(e.target))return;
  bpMutPopClose();
});
/* Tab ITEM di backpack: tile icon ringkas; klik -> popup konfirmasi PAKAI. Item: Weather / Luck / Speed Potion. */
function bpItemDef(kind){
  if(kind==='potion'){const aw=activeWeatherId();return{kind,name:'WEATHER POTION',icon:'assets/images/weather-potion.webp?v=1',emoji:'🧪',cnt:state.potions||0,
    desc:'Gacha cuaca · chance asli + pity. Hasil sama/lebih bagus = pindah + timer reset 5 menit; lebih jelek = cuaca tetep.',
    active:aw?`<br><strong style="color:${WEATHER[aw].color}">Aktif: <span style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle">${weatherSvg(aw,13)}</span> ${WEATHER[aw].name}</strong>`:'',use:'bpUsePotion()'};}
  if(kind.startsWith('luck')){const lv=+kind[4],d=LUCK_POTS[lv],b=activeLuckBuff(),bp=activeLuckBuffPct();return{kind,name:'LUCK POTION L'+lv,icon:thumbSrc(`assets/images/pot-luck-${lv}.webp`),emoji:'🍀',cnt:(state.luckPots&&state.luckPots[lv-1])||0,
    desc:`+${d.flat} flat luck${d.pct?` & +${Math.round(d.pct*100)}% luck`:''} selama 5 menit per pot. Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.`,
    active:b||bp?`<br><strong style="color:#5eead4">Aktif: +${b} LUCK${bp?` · +${Math.round(bp*100)}%`:''}</strong>`:'',use:`bpUseLuckPotion(${lv},1)`,useAll:`bpUseLuckPotion(${lv},'all')`};}
  if(kind.startsWith('speed')){const lv=+kind.slice(-1),d=SPEED_POTS[lv],b=activeSpeedBuff();return{kind,name:'SPEED POTION L'+lv,icon:thumbSrc(`assets/images/pot-speed-${lv}.webp`),emoji:'⚡',cnt:(state.speedPots&&state.speedPots[lv-1])||0,
    desc:`Roll speed +${d.add.toFixed(1)}× selama 5 menit per pot (cap total ×20). Stackable — efek dijumlah, durasi nambah +5 menit tiap pot.`,
    active:b?`<br><strong style="color:#fcd34d">Aktif: +${b.toFixed(1)}× SPEED</strong>`:'',use:`bpUseSpeedPotion(${lv},1)`,useAll:`bpUseSpeedPotion(${lv},'all')`};}
  if(kind==='r5k'){return{kind,name:'INSTAN ROLL 5K',icon:'assets/images/instanpack-5k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r5k)||0,
    desc:'SPECIAL ROLL PACK - Berisi 5.000 tarikan kartu instan ke dalam koleksi.',
    active:'',isPack:true,use:"bpUseRollPack('r5k', 5000, window.bpPackN)"};}
  if(kind==='r10k'){return{kind,name:'INSTAN ROLL 10K',icon:'assets/images/instanpack-10k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r10k)||0,
    desc:'SPECIAL ROLL PACK - Berisi 10.000 tarikan kartu instan ke dalam koleksi.',
    active:'',isPack:true,use:"bpUseRollPack('r10k', 10000, window.bpPackN)"};}
  if(kind==='r25k'){return{kind,name:'INSTAN ROLL 25K',icon:'assets/images/instanpack-25k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r25k)||0,
    desc:'SPECIAL ROLL PACK - Berisi 25.000 tarikan kartu instan ke dalam koleksi.',
    active:'',isPack:true,use:"bpUseRollPack('r25k', 25000, window.bpPackN)"};}
  if(kind==='r50k'){return{kind,name:'INSTAN ROLL 50K',icon:'assets/images/instanpack-50k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r50k)||0,
    desc:'SPECIAL ROLL PACK - Berisi 50.000 tarikan kartu instan ke dalam koleksi.',
    active:'',isPack:true,use:"bpUseRollPack('r50k', 50000, window.bpPackN)"};}
  if(kind==='r100k'){return{kind,name:'INSTAN ROLL 100K',icon:'assets/images/instanpack-100k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r100k)||0,
    desc:'SPECIAL ROLL PACK - Berisi 100.000 tarikan kartu instan ke dalam koleksi.',
    active:'',isPack:true,use:"bpUseRollPack('r100k', 100000, window.bpPackN)"};}
  if(kind==='intan'){return{kind,name:'INTAN ROLL 100K',icon:(state.intanRolls&&state.intanRolls>0?'assets/images/icon-index-card.webp':'assets/sprites/_placeholder.svg'),emoji:'💎',cnt:state.intanRolls||0,
    desc:'ITEM INDEX REWARD — didapat otomatis tiap 5 varian kartu terkumpul di Card Index (semua mutasi + varian shiny dihitung). Pakai = langsung menarik 100.000 roll kartu ke koleksi.',
    active:'',isPack:true,use:'bpUseIntanRoll(window.bpPackN)'};}
  return null;
}
/* ===== TAB ITEM (prototipe bp3 #v-item, DIKUNCI user) — PRESENTASI SAJA =====
   Bentuk: .bp-itemboard -> .btitle + strip BUFF AKTIF (chip live per buff) + grup kartu
   (.igroup + .igroup-h). SATU sumber daftar = `kinds` di renderBpItems; grup = predikat,
   bukan jumlah hardcoded. Kartu HANYA pintu masuk: onclick tetap bpItemPop(kind) (popup lama
   punya jalur pakai/multiplier — tidak diganti, tidak diduplikasi). Nol emoji, nol onerror:
   <img alt> saja. Semua angka dari data nyata: bpItemDef / LUCK_POTS / SPEED_POTS /
   POTION_BUFF_MS / PACK_ROLL_AMOUNT — tidak ada field atau aturan baru.
   Warna grup lewat custom property --bcol (bukan inline color), pola sama seperti port TREE. */
const BP_ITEM_GROUPS=[
  {cls:'luck',label:'LUCK POTION',test:k=>k.startsWith('luck')},
  {cls:'speed',label:'SPEED POTION',test:k=>k.startsWith('speed')},
  {cls:'roll',label:'ROLL PACK',test:k=>bpPackRollAmountOf(k)>0},
];
const BP_ITEM_BCOL={luck:'#5eead4',speed:'#ffd27a',roll:'#ff2e88'};
/* Kartu ×0 tetap bisa diklik (badge ×0 redup + aria-disabled) supaya jalur info/beli di
   bpItemPop tidak pernah hilang; YANG dinonaktifkan hanya tombol aksi (disabled). */
function bpItemCardHtml(kind){
  const d=bpItemDef(kind);if(!d)return '';
  const has=d.cnt>0;
  /* Kartu = DIV role=button (bukan <button>) supaya tombol aksi di dalamnya tetap HTML valid.
     Tombol aksi = BUTTON sungguhan (prototipe _tmp/proto_backpack_v3.html .potuse):
     klik tombol -> pakai 1 item (TIDAK buka modal); klik badan kartu -> bpItemPop(). */
  return `<div class="bp-itemcard${has?'':' off'}" data-item="${kind}" role="button" tabindex="0" aria-disabled="${has?'false':'true'}" aria-label="${d.name} · dimiliki ×${fmt(d.cnt)}" onclick="bpItemPop('${kind}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();bpItemPop('${kind}');}"><span class="bi-qty${has?'':' zero'}">×${fmt(d.cnt)}</span><span class="bi-ic"><img src="${d.icon}" alt="${d.name}" loading="lazy" decoding="async"></span><span class="bi-name">${d.name}</span><button type="button" class="bi-act${d.isPack?' roll':''}" onclick="event.stopPropagation();bpItemUse('${kind}')" ${has?'':'disabled'}>${d.isPack?'GULUNG':'PAKAI'}</button></div>`;
}
/* Pakai 1 item LANGSUNG dari kartu (tidak lewat modal) — memakai handler yang sudah ada,
   tidak ada mekanik baru: PAKAI potion = 1 pot (bukan 'all'), GULUNG pack = 1 paket.
   x0 = tidak ada aksi (tombol disabled + guard jumlah). */
function bpItemUse(kind){
  const d=bpItemDef(kind);if(!d)return;
  if((d.cnt||0)<=0)return;
  if(kind.startsWith('luck')){bpUseLuckPotion(+kind.slice(4),1);return;}
  if(kind.startsWith('speed')){bpUseSpeedPotion(+kind.slice(5),1);return;}
  if(kind==='potion'){bpUsePotion();return;}
  if(kind==='intan'){bpUseIntanRoll(1);return;}
  if(d.isPack){bpUseRollPack(kind,bpPackRollAmountOf(kind),1);return;}
}
/* Chip buff = sumber yang sama dengan dock lobby (renderBuffDock ~293): luckBuffs()/
   speedBuffs() per level + boost ADS; countdown pakai fmtCountdown yang sama. */
function bpItemBuffChip(cls,label,ms){
  return `<span class="buffchip ${cls}" style="--bcol:${BP_ITEM_BCOL[cls]||''}"><span class="bi-lbl">${label}</span><b class="num" data-bpcd="${Date.now()+Math.max(0,ms)}">${fmtCountdown(ms)}</b></span>`;
}
function bpItemBuffStripHtml(){
  const ls=luckBuffs().slice().sort((a,b)=>a.lv-b.lv);
  const ss=speedBuffs().slice().sort((a,b)=>a.lv-b.lv);
  const adMs=(typeof adLuckLeftMs==='function')?adLuckLeftMs():0;
  const chips=[];
  if(adMs>0)chips.push(bpItemBuffChip('luck','ADS 2× LUCK',adMs));
  ls.forEach(b=>chips.push(bpItemBuffChip('luck',`LUCK L${b.lv} · +${b.flat||0} FLAT${b.pct?` & +${Math.round(b.pct*100)}%`:''}`,b.endsAt-Date.now())));
  ss.forEach(b=>chips.push(bpItemBuffChip('speed',`SPEED L${b.lv} · +${(b.add||0).toFixed(1)}×`,b.endsAt-Date.now())));
  return `<div class="buffstrip" id="bpItemBuffStrip"><span class="bk">BUFF AKTIF</span>${chips.length?chips.join(''):'<span class="bnone">TIDAK ADA BUFF BERJALAN</span>'}</div>`;
}
/* Tick per detik ala dock: HANYA textContent badge (tanpa innerHTML berkala = anti flicker/
   anti scroll loncat). Rebuild strip sekali saja saat semua buff habis -> strip tidak pernah
   hilang tinggi, pesannya "TIDAK ADA BUFF BERJALAN". Early-return kalau tab lain yang aktif. */
function bpItemBuffTick(){
  const strip=document.getElementById('bpItemBuffStrip');if(!strip)return;
  const nums=strip.querySelectorAll('[data-bpcd]');if(!nums.length)return;
  let alive=0;
  nums.forEach(el=>{const rem=+el.getAttribute('data-bpcd')-Date.now();el.textContent=fmtCountdown(rem);if(rem>0)alive++;});
  if(!alive)strip.innerHTML='<span class="bk">BUFF AKTIF</span><span class="bnone">TIDAK ADA BUFF BERJALAN</span>';
}
setInterval(bpItemBuffTick,1000);
function renderBpItems(){
  const kinds=['luck1','luck2','luck3','speed1','speed2','speed3','r5k','r10k','r25k','r50k','r100k'];
  const groups=BP_ITEM_GROUPS.map(g=>{
    const ks=kinds.filter(k=>g.test(k)&&bpItemDef(k));
    if(!ks.length)return '';
    return `<div class="igroup" style="--bcol:${BP_ITEM_BCOL[g.cls]}"><div class="igroup-h ${g.cls}">${g.label}</div><div class="bp-itemcards">${ks.map(k=>bpItemCardHtml(k)).join('')}</div></div>`;
  }).join('');
  return `<div class="bp-itemboard"><div class="btitle">ITEM · POTION &amp; ROLL PACK</div>${bpItemBuffStripHtml()}${groups}</div>`;
}
function bpItemPop(kind){
  bpItemPopClose();
  const d=bpItemDef(kind); if(!d)return;
  const isGacha=(kind==='potion'||kind==='mythic');
  const isRollPack=kind.startsWith('r');
  const odds=isGacha?weatherOddsHTML():'';
  const multi=isGacha?`<div class="bpholo-multi-wrap"><div class="bpholo-multi-label">JUMLAH ROLL:</div><div class="wo-multi">${[1,5,25,100].map(n=>`<button data-n="${n}" class="${bpMultiN===n?'on':''}" onclick="bpSetMulti(${n})">${n}×</button>`).join('')}</div></div>`:'';
  const isPack=!!d.isPack;
  if(isPack){
    /* Inisialisasi pack counter & default multiplier */
    bpPopupKind=kind; bpPackCnt=d.cnt; bpPackRollAmount=(kind==='intan')?100000:bpPackRollAmountOf(kind);
    if(d.cnt>=10){ bpPackN=10; window.bpPackIsAll=false; }
    else if(d.cnt>0 && d.cnt<10){ bpPackN=d.cnt; window.bpPackIsAll=true; }
    else { bpPackN=1; window.bpPackIsAll=false; }
    window.bpPackN=bpPackN;
  }
  const packMulti=isPack?`<div class="bpholo-multi-wrap"><div class="bpholo-multi-label">JUMLAH PAKET:</div><div class="wo-multi bp-pack-toggle">${PACK_MULTI_LIST.map(val => {
    const isAll = (val === 'ALL');
    const isDisabled = isAll ? (d.cnt < 1) : (d.cnt < val);
    const isSelected = isAll ? (window.bpPackIsAll || (d.cnt > 0 && d.cnt < 10 && bpPackN === d.cnt)) : (!window.bpPackIsAll && bpPackN === val);
    const label = isAll ? 'ALL' : (val + '×');
    return `<button data-pn="${val}" class="${isSelected ? 'on' : ''} ${isAll ? 'btn-all' : ''}" ${isDisabled ? 'disabled' : ''} onclick="bpSetPackN('${val}')">${label}</button>`;
  }).join('')}</div>${bpPackInfoHTML(d.cnt)}`:'';
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
        ${d.active?`<div class="bpholo-active-eff">${d.active}</div>`:''}
        ${odds}
        ${multi}
        ${packMulti}
      </div>

      <div class="bpholo-actions">
        <button class="bpholo-btn-use ${canUse?'':'disabled'}" ${canUse?'':'disabled'} type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>${isPack ? (window.bpPackIsAll ? ('PAKAI SEMUA (' + fmt(bpPackN) + '× paket)') : ('PAKAI SEKARANG' + (bpPackN > 1 ? ' (' + fmt(bpPackN) + '× paket)' : ''))) : ('PAKAI SEKARANG' + (isGacha && bpMultiN > 1 ? ' (' + bpMultiN + '×)' : ''))}</span>
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
/* Toggle jumlah pemakaian Instan Pack (10 / 25 / 50 / 100 / ALL) — tanpa batas jumlah tarikan. */
const PACK_MULTI_LIST = [10, 25, 50, 100, 'ALL'];
const PACK_ROLL_AMOUNT = {r5k:5000, r10k:10000, r25k:25000, r50k:50000, r100k:100000};
let bpPackN = 10;
let bpPopupKind = '';
let bpPackCnt = 0;
let bpPackRollAmount = 0;
window.bpPackN = 10;
window.bpPackIsAll = false;
function bpPackRollAmountOf(kind){return PACK_ROLL_AMOUNT[kind]||0;}
function bpPackInfoHTML(cnt){
  const n = bpPackN;
  const packs = Math.min(n, Math.max(0, cnt || 0));
  const pulls = bpPackRollAmount * packs;
  return `<div class="bpholo-packinfo">PAKAI <b>${fmt(packs)}</b> PAKET · TOTAL <b>${fmt(pulls)}</b> TARIKAN</div>`;
}
function bpSetPackN(n){
  const cnt = (typeof bpPackCnt === 'number') ? bpPackCnt : 0;
  if(n === 'ALL' || n === 'all'){
    if(cnt < 1){
      toast("STOK HABIS", "TIDAK ADA PAKET", "#f87171");
      return;
    }
    bpPackN = cnt;
    window.bpPackN = cnt;
    window.bpPackIsAll = true;
    document.querySelectorAll('#itemPop .wo-multi button[data-pn]').forEach(b => {
      b.classList.toggle('on', b.dataset.pn === 'ALL');
    });
  } else {
    window.bpPackIsAll = false;
    const num = parseInt(n, 10);
    if(num > cnt){
      toast("STOK TIDAK CUKUP", "PUNYA " + fmt(cnt) + " PAKET", "#f87171");
      return;
    }
    bpPackN = num;
    window.bpPackN = num;
    document.querySelectorAll('#itemPop .wo-multi button[data-pn]').forEach(b => {
      b.classList.toggle('on', b.dataset.pn === String(num));
    });
  }
  const info = document.querySelector('#itemPop .bpholo-packinfo');
  if(info && info.outerHTML !== undefined){
    const tmp = document.createElement('div');
    tmp.innerHTML = bpPackInfoHTML(cnt);
    info.replaceWith(tmp.firstElementChild || info);
  }
  const useSpan = document.querySelector('#itemPop .bpholo-btn-use span');
  if(useSpan){
    if(window.bpPackIsAll){
      useSpan.textContent = `PAKAI SEMUA (${fmt(bpPackN)}× paket)`;
    } else {
      useSpan.textContent = `PAKAI SEKARANG${bpPackN > 1 ? ' (' + fmt(bpPackN) + '× paket)' : ''}`;
    }
  }
}
window.bpSetPackN = bpSetPackN;
function bpSetMulti(n){
  bpMultiN=n;
  document.querySelectorAll('#itemPop .wo-multi button[data-n]').forEach(b=>b.classList.toggle('on',+b.dataset.n===n));
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
/* Pakai INTAN ROLL 100K: tarik 100.000 roll sekaligus (×N paket), lalu tampilkan ringkasan loot.
   0039: dengan sesi cloud intan DIPOTONG DI SERVER lewat spend_intan() sebelum roll jalan —
   `state.intanRolls` cuma cermin, dan merge menulis balik kredit server, jadi angka F12 tidak
   bisa dipakai mencetak intan lagi. RPC gagal = TIDAK ada roll (kalau roll jalan duluan lalu
   kredit tidak kepotong, item-nya bisa dipakai selamanya). Tanpa sesi = jalur lokal lama. */
async function bpUseIntanRoll(n){
  n=Math.max(1,parseInt(n,10)||1);
  const owned=state.intanRolls||0;
  if(owned<1){toast("INTAN ROLL habis","GAK ADA ITEM","#f87171");return;}
  const use=Math.min(n,owned);
  bpItemPopClose();
  let pulls=100000*use, spent=use;
  if(typeof srOn==="function"&&srOn()){
    const r=await CloudDB.spendIntan(currentUser,use);
    if(!r||!r.ok){
      const msg=!r?"KONEKSI KE SERVER PUTUS":(r.msg==="NO_INTAN"?"KREDIT INTAN SUDAH HABIS":"DITOLAK SERVER");
      toast("INTAN DITOLAK SERVER",msg+" · COBA LAGI","#f87171");
      renderBackpackPanel();
      return;
    }
    /* Server yang memutuskan berapa intan yang benar-benar kepotong: client boleh
       saja mengklaim 999, kreditnya cuma 2 -> yang dipakai 2, bukan 999. */
    spent=Math.max(1,Number(r.spent)||use);
    pulls=Number(r.pulls)||pulls;
  }else{
    state.intanRolls=owned-use;save();
  }
  beep(440,.18,"triangle",.1);setTimeout(()=>beep(880,.24,"triangle",.08),150);
  const loot=instantRollFast(pulls,true);
  showTowerLoot(loot,{weather:0,luck:0,speed:0},"HASIL INTAN ROLL · "+fmt(pulls)+" ("+spent+"×)");
  renderBackpackPanel();
}
async function bpUseRollPack(packKey, rollAmount, n){
  n=Math.max(1,parseInt(n,10)||1);
  state.rollPacks = state.rollPacks || {};
  /* 0040: tidak ada lagi `dailyR100kBalance` — jumlah pack yang terlihat di sini
     adalah cermin ledger `player_packs` (klaim client di-nol-kan merge kalau lebih). */
  const owned=state.rollPacks[packKey]||0;
  if(owned<1){toast("PACK HABIS","TIDAK ADA ITEM","#f87171");return;}
  const use=Math.min(n,owned);
  bpItemPopClose();
  beep(520,.18,"triangle",.1);setTimeout(()=>beep(940,.24,"triangle",.08),150);
  /* 0041 (Unit 5b-2): dengan sesi cloud pack DIPOTONG DI SERVER lewat bulk_roll() dan
     kartu diacak di sana — `state.rollPacks` cuma cermin, jadi angka F12 tidak bisa
     dipakai mencetak pack maupun isinya. Server clamp 10 pack per panggilan
     (roll_config.bulk_max_packs) karena rate limit 120 RPC/menit, jadi pemakaian
     banyak pack = beberapa RPC. Cermin server ikut dibalas tiap panggilan, jadi
     sisa loop dihitung ulang dari nilai itu: mirror palsu 999999 tetap berhenti
     begitu ledger aslinya habis (chunk berikutnya PACK_EMPTY).
     RPC gagal di tengah jalan = tetap tampilkan yang SUDAH dibayar server (kartunya
     sudah ditulis di DB); yang belum jalan tidak di-roll. */
  if(typeof srOn==="function"&&srOn()&&typeof CloudDB!=="undefined"&&CloudDB.bulkRoll){
    const groups={}, order=[];
    let total=0, spent=0, left=use, guard=0;
    const maxGuards = Math.max(20, Math.ceil(use / 10) + 5);
    while(left>0 && guard++<maxGuards){
      const r=await CloudDB.bulkRoll(currentUser,packKey,Math.min(left,10));
      if(!r||!r.ok){
        const msg=!r?"KONEKSI KE SERVER PUTUS":(r.msg==="PACK_EMPTY"?"LEDGER SERVER: PACK HABIS":"DITOLAK SERVER: "+(r.msg||""));
        if(spent===0){ toast("PACK DITOLAK SERVER",msg+" · COBA LAGI","#f87171"); renderBackpackPanel(); return; }
        toast("ROLL DIHENTIKAN SERVER",msg+" · "+fmt(spent)+"× SUDAH MASUK","#fcd34d");
        break;
      }
      const used=Math.max(1,Number(r.used)||1);
      spent+=used; total+=Number(r.total)||0;
      for(const g of (r.results||[])){
        const key=g.cardId+"|"+(g.mut||"none")+"|"+(g.shiny?1:0);
        let it=groups[key];
        if(!it){ it=groups[key]={cardId:g.cardId,tier:g.tier,mut:g.mut||"none",shiny:!!g.shiny,chance:g.chance,n:0}; order.push(key); }
        it.n+=Number(g.n)||1;
      }
      left=Math.min(left-used, state.rollPacks[packKey]||0);
    }
    const loot=order.map(k=>groups[k]);
    loot.totalPulls=total;
    if(!total){ renderBackpackPanel(); return; }
    if(loot.length){
      loot.slice().sort((a,b)=>(a.chance||0)-(b.chance||0)).slice(-10).forEach(g=>pushRollHistory(g,true));
      if(typeof window.l12ScheduleRollHistPaint==="function")window.l12ScheduleRollHistPaint();
    }
    showTowerLoot(loot,{weather:0,luck:0,speed:0},'HASIL INSTAN ROLL · ' + fmt(total)+" ("+spent+"×)");
    renderBackpackPanel();
    return;
  }
  /* Tanpa sesi cloud: jalur lokal lama (tidak ada yang bisa dilindungi — tidak ada
     account, jadi tidak ada ekonomi yang dipertaruhkan). */
  state.rollPacks[packKey]=Math.max(0,owned-use);
  save();
  const pulls=rollAmount*use;
  const loot=instantRollFast(pulls,true);
  showTowerLoot(loot,{weather:0,luck:0,speed:0},'HASIL INSTAN ROLL · ' + pulls.toLocaleString()+" ("+use+"×)");
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
/* ===== SKILL TREE CONSTELLATION (prototipe terkunci bp3 v3) — PRESENTASI SAJA.
   BPWEB_POS = koordinat persen kanvas: root di puncak, LUCK melengkung kiri, SPEED kanan,
   BOOSTER kolom tengah. TREE_NODES tetap satu-satunya sumber nama/biaya/req/gain —
   jumlah node dan edge dibaca dari data, tidak di-hardcode. ===== */
const BPWEB_POS={root:[50,7],
  lk1:[28,20],lk2:[16,34],lk3:[11,49],lk4:[10,65],lk5:[16,80],
  sp1:[72,20],sp2:[84,34],sp3:[89,49],sp4:[90,65],sp5:[84,80],
  bst1:[50,31],bst2:[50,46],bst3:[50,61],bst4:[50,76],bst5:[50,92]};
/* Empat state sama persis seperti slNodeHtml lama: owned / ready (dulu avail) / poor / locked. */
function bpTreeState(n,sp){
  if(n.branch==='root'||treeOwned(n.id))return 'owned';
  const preqMet=n.req.every(r=>r==='root'||treeOwned(r));
  if(!preqMet)return 'locked';
  return sp>=n.cost?'ready':'poor';
}
function bpNodeGain(n){
  if(n.branch==='luck')return '+'+n.luck+' LUCK'+(n.luckPct?' · +'+Math.round(n.luckPct*100)+'% mult':'');
  if(n.branch==='speed')return '+'+n.speed.toFixed(1)+'× roll speed';
  if(n.branch==='booster')return '+'+n.luck+' LUCK · +'+Math.round((n.luckPct||0)*100)+'% mult';
  return 'AKAR';
}
/* SVG edge layer: SATU garis per entri req di TREE_NODES (root→lk1…, root→sp1…, booster dari req-nya sendiri). */
function bpWebLinesHtml(){
  const segs=[];
  for(const n of TREE_NODES){
    if(n.id==='root')continue;
    const B=BPWEB_POS[n.id];if(!B)continue;
    for(const r of n.req){
      const A=BPWEB_POS[r];if(!A)continue;
      const live=(r==='root'||treeOwned(r))&&treeOwned(n.id);
      const cls=(live?'live '+(r==='root'&&n.branch!=='booster'?'root':n.branch):'')+' ln-'+n.branch;
      segs.push(`<line class="${cls.trim()}" x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}"/>`);
    }
  }
  return `<svg class="weblines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${segs.join('')}</svg>`;
}
/* Node heksagon konstelasi. Klik -> DETAIL node (prototipe bp3 openNode): beli lewat tombol BELI
   di detail, bukan langsung. Toggle: klik node terbuka yang sama = tutup; hanya satu detail aktif. */
function slNodeHtml(n,sp){
  const st=bpTreeState(n,sp);
  const core=n.branch==='root';
  const br=core?'root':n.branch;
  const gain=bpNodeGain(n);
  const p=BPWEB_POS[n.id]||[50,50];
  const cost=(!core&&st!=='owned')?`<span class="wcost num">${n.cost} SP</span>`:'';
  return `<button type="button" class="wnode ${br} ${st}${core?' core':''}" data-node="${n.id}" aria-label="${n.name} — ${gain}" aria-expanded="${_bpTreeDetailId===n.id?'true':'false'}" title="${n.name} — ${gain} · ${n.desc}" style="left:${p[0]}%;top:${p[1]}%" onclick="bpTreeDetailToggle('${n.id}')">
    ${cost}<span class="whex">${st==='locked'&&!core?'<img class="wlock" src="assets/icons/padlock.svg" alt="">':''}</span><span class="wlabel">${n.name}</span>
  </button>`;
}

function renderBpTree(){
  const sp=(state&&state.player&&state.player.sp)||0;
  const goal=TREE_NODES.filter(n=>n.id!=='root'&&!treeOwned(n.id)&&n.req.every(r=>r==='root'||treeOwned(r))).sort((a,b)=>a.cost-b.cost)[0];
  const ready=!!goal&&sp>=goal.cost;
  const hint=sp>0?'beli node buat naikkan stat':'naikkan LV buat dapet SP';
  const goalTxt=goal?(goal.name+' · '+goal.cost+' SP'+(ready?' — SIAP!':'')):'SEMUA NODE TERBUKA';
  /* SATU readout SP (prototipe bp3b): kotak di dalam board; goal + hint banner lama
     bertahan sebagai baris kompak .sp-sub di dalam .spbox — bukan blok .spbar kedua. */
  return `<div class="board">
    <div class="btitle">CONSTELLATION · PETA SKILL</div>
    <div class="webhead">
      <div class="spbox"><span class="k">SKILL POINT</span><span class="sp num">${sp}</span><span class="sp-sub"><span class="sp-goal${ready?' ready':''}">${goalTxt}</span><span class="sp-hint">${hint}</span></span></div>
      <div class="weblegend">
        <span class="l1"><i></i>DIMILIKI</span>
        <span class="l2"><i></i>SIAP BELI</span>
        <span class="l3"><i></i>TERKUNCI</span>
      </div>
    </div>
    <div class="bpweb-view">
      <div class="web">
        ${bpWebLinesHtml()}
        ${TREE_NODES.map(n=>slNodeHtml(n,sp)).join('')}
        <span class="btag luck" style="left:22%;top:10%">LUCK</span>
        <span class="btag speed" style="left:78%;top:10%">SPEED</span>
        <span class="btag booster" style="left:50%;top:21.5%" title="Butuh lk5 &amp; sp5 terbuka">BOOSTER</span>
      </div>
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
/* ===== DETAIL NODE SKILL TREE (prototipe bp3 openNode, 594-621) — PRESENTASI + BELI =====
   Modul-lokal kayak bpTarget/bpMutFilter: SATU flag node terpilih, tidak dipersist.
   Elemen body-level ala bpCardModal/bpItemPop: dibuat saat sync, dihapus saat close,
   re-render cukup sync ulang -> tak pernah dobel. Angka dari TREE_NODES + state.player.sp,
   beli lewat bpTreeBuy (tidak diubah/diduplikasi). Warna cabang lewat --bcol (bukan inline). */
let _bpTreeDetailId=null;
const BP_TREE_BCOL={root:'#5eead4',luck:'#5eead4',speed:'#ffd27a',booster:'#ff2e88'};
/* Ikon real proyek (assets/icons sudah diverifikasi ada): clover=luck, lightning-trio=speed, sparkles=booster. */
const BP_TREE_ICON={root:'clover.svg',luck:'clover.svg',speed:'lightning-trio.svg',booster:'sparkles.svg'};
function bpTreePreqNames(n){return n.req.length?n.req.map(r=>{const p=TREE[r];return p?p.name:r;}).join(' + '):'—';}
function bpTreeDetailToggle(id){ _bpTreeDetailId=(_bpTreeDetailId===id?null:id); bpTreeDetailSync(); }
function bpTreeDetailClose(){
  const e=document.getElementById('bpTreeDetail'); if(e)e.remove();
  _bpTreeDetailId=null;
  document.querySelectorAll('.wnode[data-node]').forEach(b=>b.setAttribute('aria-expanded','false'));
}
/* Beli dari detail: tutup dulu (biar sync pasca-re-render tidak membuka ulang), lalu jalur lama. */
function bpTreeDetailBuy(id){ bpTreeDetailClose(); bpTreeBuy(id); }
function bpTreeDetailSync(){
  const nodes=document.querySelectorAll('.wnode[data-node]');
  if(!_bpTreeDetailId){
    const gone=document.getElementById('bpTreeDetail'); if(gone)gone.remove();
    nodes.forEach(b=>b.setAttribute('aria-expanded','false'));
    return;
  }
  const n=TREE[_bpTreeDetailId];
  if(!n){ _bpTreeDetailId=null; const gone=document.getElementById('bpTreeDetail'); if(gone)gone.remove(); return; }
  nodes.forEach(b=>b.setAttribute('aria-expanded', b.dataset.node===_bpTreeDetailId?'true':'false'));
  let el=document.getElementById('bpTreeDetail');
  if(!el){
    el=document.createElement('div'); el.id='bpTreeDetail'; el.className='bp-treedetail';
    el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true');
    el.addEventListener('click',ev=>{ if(ev.target===el)bpTreeDetailClose(); });
    document.body.appendChild(el);
  }
  const sp=(state&&state.player&&state.player.sp)||0;
  const st=bpTreeState(n,sp);
  const core=n.branch==='root';
  const gain=bpNodeGain(n);
  const stTxt=st==='owned'?'DIMILIKI':st==='ready'?'SIAP DIBUKA':st==='locked'?'Buka node sebelumnya dulu':'SP kurang';
  const buyable=!core&&st==='ready';
  const bcol=BP_TREE_BCOL[n.branch]||BP_TREE_BCOL.luck;
  const ic='assets/icons/'+(BP_TREE_ICON[n.branch]||BP_TREE_ICON.luck);
  const x='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
  el.setAttribute('aria-label',n.name);
  el.innerHTML=`<div class="bp-td-card" style="--bcol:${bcol}">
    <button class="bp-td-x" type="button" onclick="bpTreeDetailClose()" aria-label="Tutup detail ${n.name}" title="Tutup [ESC]">${x}</button>
    <div class="bp-td-head">
      <img class="bp-td-icon" src="${ic}" alt="" decoding="async">
      <div class="bp-td-id"><div class="bp-td-name">${n.name}</div>
        <span class="bp-td-chip">${n.branch.toUpperCase()} · ${n.cost} SP</span></div>
    </div>
    <div class="bp-td-stats">
      <div class="bp-td-stat"><span class="bp-td-k">BIAYA</span><span class="bp-td-v num">${n.cost} SP</span></div>
      <div class="bp-td-stat"><span class="bp-td-k">SP LO</span><span class="bp-td-v num">${sp}</span></div>
      <div class="bp-td-stat wide"><span class="bp-td-k">PRASYARAT</span><span class="bp-td-v sm">${bpTreePreqNames(n)}</span></div>
    </div>
    <div class="bp-td-status${st==='owned'?' on':''}">${stTxt}</div>
    <div class="bp-td-eff"><span class="bp-td-k">EFEK</span><div class="bp-td-gain">${gain}</div><p class="bp-td-desc">${n.desc}</p></div>
    ${buyable?`<div class="bp-td-acts"><button class="bp-td-btn pri" type="button" onclick="bpTreeDetailBuy('${n.id}')">BELI · ${n.cost} SP</button></div>`:''}
  </div>`;
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
  return `<span class="icov"><img src="${thumbSrc(d.img)}" alt="" loading="lazy" decoding="async" onerror="this.remove()"></span>`;
}
/* Tombol beli Backpack per kanal: raid/tower TIDAK dijual pakai coin — tombol jadi petunjuk sumber. */
function bpBuyBtn(d,kind){
  if(d.src==="raid")return `<button class="bp-shop-b off" onclick="toast('TOKO WORLD BOSS','BELI PAKAI TOKEN WORLD BOSS · ${fmt(d.raidCost||0)} TOKEN','#B58CFF')">TOKO WORLD BOSS · ${fmt(d.raidCost||0)} TOKEN</button>`;
  if(d.src==="tower")return `<button class="bp-shop-b off" onclick="toast('INF TOWER','DROP BASE CHANCE — TIDAK KENA LUCK PLAYER','#7DF9FF')">DROP · INF TOWER</button>`;
  if(d.src==="premium")return `<button class="bp-shop-b buy" style="background:linear-gradient(135deg,#e6b800,#b38600);color:#0a0800;border-color:#ffd700;" onclick="openPremiumShop()">TOKO PREMIUM · ${d.gemPrice} GEMS</button>`;
  return `<button class="bp-shop-b ${(state.coins||0)>=d.price?'buy':'poor'}" onclick="bpBuy${kind}('${d.id}')">BELI · ${coinIcon(15)} ${fmt(d.price)}</button>`;
}
/* ====== TAB RELIC & PET (prototipe bp3 #v-relic / #v-pet, DIKUNCI user) — PRESENTASI SAJA.
   Bentuk RELIC: .bp-relicboard -> .btitle + .bp-coinrow + .eqslots (2 slot) + .igroup-h + .relicgrid.
   Bentuk PET : .bp-petboard  -> .btitle + .bp-coinrow + .bp-petheroes + .igroup-h + .petgrid.
   Yang TIDAK disentuh (mekanik user): kepemilikan/slot tetap state.artOwned / state.artSlots (2) /
   state.petOwned / state.petEquipped; pasang-lepas tetap bpToggleArt/bpTogglePet; lepas dari slot
   tetap bpArtSlot(i); beli tetap bpBuyBtn(d,'Art'|'Pet') — string kanal aslinya ("TOKO WORLD BOSS ·
   n TOKEN", "DROP · INF TOWER", "TOKO PREMIUM · n GEMS", "BELI · n") dipanggil dari helper itu,
   TIDAK ditulis ulang di sini. Angka tetap totalLuck()/luckTxt(d), warna tetap d.color,
   renderGlobalLuckWidget() tetap paling atas. Nol emoji: glif luck = assets/icons/clover.svg,
   slot kosong = SVG plus, span fallback emoji (glif pet) dibuang — <img alt> sudah cukup.
   Warna lewat custom property --ec (pola sama seperti port TREE/ITEM), bukan inline color. */
const BP_CLOVER='<img class="bp-luckglyph" src="assets/icons/clover.svg" alt="" width="13" height="13" loading="lazy" decoding="async">';
const BP_PLUS='<svg class="bp-eqplus" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';
const BP_LOCK='<img class="bp-tlock" src="assets/icons/padlock.svg" alt="" loading="lazy" decoding="async">';
const BP_X='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
/* Art tile: webp asli (thumbSrc) atau SVG fallback artIconSvg — file gambar tidak disentuh. */
function bpGearArtHtml(d,cls){
  if(!d.img)return artIconSvg(d.icon);
  return `<img${cls?' class="'+cls+'"':''} src="${thumbSrc(d.img)}" alt="${d.name}" loading="lazy" decoding="async">`;
}
/* Badge status kartu — dari state + ART_DEFS/PET_DEFS yang ada (d.src), bukan aturan baru.
   Lencana non-aktif hanya SINGKATAN kanal (TOKEN WB / DROP / GEM / COIN); kalimat kanal yang
   sebenarnya tetap milik bpBuyBtn() dan muncul utuh di modal — tidak ditulis ulang di sini. */
function bpGearStatus(d,owned,active){
  if(active)return{t:'AKTIF',cls:'act'};
  if(owned)return{t:'MILIK',cls:'own'};
  return{t:d.src==='raid'?'TOKEN WB':d.src==='tower'?'DROP':d.src==='premium'?'GEM':'COIN',cls:'lock '+(d.src||'coin')};
}
/* Baris angka global (luck + coin) — sama seperti sebelumnya, TANPA glif shamrock. */
function bpGearCoinRow(coins){
  return `<div class="bp-coinrow">${BP_CLOVER}<b class="num">${totalLuck().toFixed(1)}×</b><span class="bp-sep" aria-hidden="true">·</span>${coinIcon(15)}<b class="num">${fmt(coins)}</b></div>`;
}
/* Slot artefak terisi = pintu LEPAS via bpArtSlot(i) — perilaku lama persis. */
function bpRelicSlotHtml(i){
  const id=state.artSlots[i],d=id?ART_DEFS.find(x=>x.id===id):null;
  if(!d)return `<button type="button" class="eqslot empty" onclick="toast('SLOT KOSONG','BELI ARTEFAK DULU','#fcd34d')" aria-label="Slot ${i+1} kosong">${BP_PLUS}<span class="ek">SLOT ${i+1} KOSONG</span></button>`;
  return `<button type="button" class="eqslot on" style="--ec:${d.color}" onclick="bpArtSlot(${i})" aria-label="Slot ${i+1}: ${d.name} — klik untuk lepas">
    <span class="eqk">SLOT ${i+1}</span>${bpGearArtHtml(d,'eqart')}
    <span class="eqmeta"><span class="eqn">${d.name}</span><span class="eql num">${luckTxt(d)}</span><span class="eqs">TERPASANG · KLIK UNTUK LEPAS</span></span></button>`;
}
function bpRelicTileHtml(d){
  const owned=state.artOwned.includes(d.id),eq=state.artSlots.includes(d.id);
  const s=bpGearStatus(d,owned,eq);
  return `<button type="button" class="relictile${owned?'':' locked'}${eq?' eqd':''}" style="--ec:${d.color}" aria-label="${d.name} · ${luckTxt(d)}" onclick="bpGearModalOpen('art','${d.id}')">
    <span class="rtchip ${s.cls}">${s.t}</span>${BP_LOCK}<span class="rts" aria-hidden="true"></span>${bpGearArtHtml(d)}
    <span class="rtn">${d.name}</span></button>`;
}
function renderBpArts(){
  return `<div class="bp-relicboard"><div class="btitle">RELIC · SLOT ARTEFAK (MAKS 2)</div>
  <div class="eqslots">${[0,1].map(i=>bpRelicSlotHtml(i)).join('')}</div>
  <div class="igroup-h">ARTEFAK</div>
  <div class="relicgrid">${ART_DEFS.map(d=>bpRelicTileHtml(d)).join('')}</div></div>`;
}
/* Hero pet aktif = blok besar di atas grid; state kosong TIDAK collapse — elemennya selalu ada
   dengan kelas .none + tiga baris pesan, jadi tinggi blok dijaga CSS (min-height), bukan oleh data. */
function bpPetHeroHtml(){
  const d=state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;
  if(!d)return `<div class="pethero none"><span class="phinfo"><span class="phk">PET AKTIF</span><span class="phn">TIDAK ADA PET AKTIF</span><span class="phst">PILIH PET DI BAWAH INI · KLIK KARTU UNTUK DETAIL</span></span></div>`;
  return `<button type="button" class="pethero on" style="--ec:#7DF9FF" onclick="bpGearModalOpen('pet','${d.id}')" aria-label="${d.name} — pet aktif, klik untuk detail">
    ${bpGearArtHtml(d,'phimg')}
    <span class="phinfo"><span class="phk">PET AKTIF</span><span class="phn">${d.name}</span>
      <span class="phstat"><span class="phs"><span class="k">LUCK FLAT</span><span class="v num">+${d.flat||0}</span></span><span class="phs"><span class="k">LUCK %</span><span class="v num">+${d.pct||0}%</span></span></span>
      <span class="phst">${luckTxt(d)}</span></span></button>`;
}
function bpPetTileHtml(p){
  const owned=state.petOwned.includes(p.id),eq=state.petEquipped===p.id;
  const s=bpGearStatus(p,owned,eq);
  return `<button type="button" class="pettile${owned?'':' locked'}${eq?' act':''}" style="--ec:#7DF9FF" aria-label="${p.name} · ${luckTxt(p)}" onclick="bpGearModalOpen('pet','${p.id}')">
    <span class="ptchip ${s.cls}">${s.t}</span>${BP_LOCK}<span class="onair" aria-hidden="true"></span>${bpGearArtHtml(p)}
    <span class="ptn">${p.name}</span></button>`;
}
function renderBpPets(){
  return `<div class="bp-petboard"><div class="btitle">PET · 1 SLOT AKTIF</div>
  <div class="bp-petheroes">${bpPetHeroHtml()}</div>
  <div class="igroup-h">SEMUA PET</div>
  <div class="petgrid">${PET_DEFS.map(p=>bpPetTileHtml(p)).join('')}</div></div>`;
}
/* ---- Modal detail artefak/pet: memakai KELAS yang SUDAH ada dan sudah bergaya
   (.bp-cardmodal + .bp-cm-*), tapi elemen body-level sendiri (#bpGearModal) supaya
   bpCardModalSync (milik tab DECK) tidak perlu disentuh. Bukan gaya modal ketiga. ---- */
let _bpGearModal=null;
function bpGearModalOpen(kind,id){bpCardModalClose();_bpGearModal={kind,id};bpGearModalSync();}
function bpGearModalClose(){const e=document.getElementById('bpGearModal');if(e)e.remove();_bpGearModal=null;}
function bpGearModalSync(){
  if(!_bpGearModal)return;
  const isPet=_bpGearModal.kind==='pet';
  const d=(isPet?PET_DEFS:ART_DEFS).find(x=>x.id===_bpGearModal.id);
  if(!d){bpGearModalClose();return;}
  let el=document.getElementById('bpGearModal');
  if(!el){
    el=document.createElement('div');el.id='bpGearModal';el.className='bp-cardmodal bp-gearmodal';
    el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
    el.addEventListener('click',ev=>{
      if(ev.target===el){bpGearModalClose();return;}
      /* tombol beli datang dari bpBuyBtn (onclick milik helper itu) — modal ditutup setelahnya
         supaya re-render panel menampilkan status kepemilikan yang baru. */
      if(ev.target.closest&&ev.target.closest('.bp-shop-b'))bpGearModalClose();
    });
    document.body.appendChild(el);
  }
  const owned=isPet?state.petOwned.includes(d.id):state.artOwned.includes(d.id);
  const active=isPet?state.petEquipped===d.id:state.artSlots.includes(d.id);
  const stat=(k,v)=>`<div class="bp-cm-st"><span class="bp-cm-k">${k}</span><span class="bp-cm-v">${v}</span></div>`;
  const ownLine=active?(isPet?'PET AKTIF':'TERPASANG · SLOT '+(state.artSlots.indexOf(d.id)+1)):(owned?'DIMILIKI':'BELUM DIMILIKI');
  const toggle="bpToggle"+(isPet?'Pet':'Art')+"('"+d.id+"')";
  const acts=active?`<button class="bp-cm-btn warn" type="button" onclick="${toggle};bpGearModalClose()">LEPAS</button>`
    :owned?`<button class="bp-cm-btn pri" type="button" onclick="${toggle};bpGearModalClose()">PASANG</button>`
    :`<div class="bp-cm-buy">${bpBuyBtn(d,isPet?'Pet':'Art')}</div>`;
  el.setAttribute('aria-label',d.name);
  el.style.setProperty('--ec',isPet?'#7DF9FF':d.color); /* sumber sama seperti grid: artefak d.color, pet #7DF9FF (renderBpArts/renderBpPets) */
  el.innerHTML=`<div class="bp-cm-panel">
    <button class="bp-cm-x" type="button" onclick="bpGearModalClose()" aria-label="Tutup" title="Tutup [ESC]">${BP_X}</button>
    <div class="bp-cm-top">
      <div class="bp-cm-art gear">${d.img?`<img src="${d.img}" alt="${d.name}" decoding="async">`:artIconSvg(d.icon)}</div>
      <div class="bp-cm-info">
        <div class="bp-cm-name">${d.name}</div>
        <span class="bp-cm-chip">${isPet?'PET':'ARTEFAK'}</span>
        <div class="bp-cm-stats">${stat('LUCK FLAT','+'+(d.flat||0))}${stat('LUCK %','+'+(d.pct||0)+'%')}</div>
        <div class="bp-cm-own${active?' on':''}">${ownLine}</div>
      </div>
    </div>
    <div class="bp-cm-pass"><span class="bp-cm-k">EFEK</span><div class="bp-cm-skill">${luckTxt(d)}</div></div>
    <div class="bp-cm-acts">${acts}</div>
  </div>`;
}
/* Esc berjenjang untuk modal gear (capture, sebelum boot.js menutup backpack) + tutup saat
   pindah tab / menekan tutup — pola sama seperti rantai modal kartu. */
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape'||!_bpGearModal)return;
  e.stopPropagation();e.preventDefault();bpGearModalClose();
},true);
document.addEventListener('click',function(e){
  if(!_bpGearModal)return;
  if(e.target.closest&&e.target.closest('.bp-tab,.backpack-close'))bpGearModalClose();
},true);

/* Pesan galat RPC beli item (0028) -> teks yang bisa dibaca pemain. */
function bpBuyErr(res){
  const m=(res&&res.msg)||"";
  const map={COIN_KURANG:"COIN KURANG",GEMS_TIDAK_CUKUP:"GEMS KURANG",BAD_ITEM:"ITEM TIDAK DIKENAL",
             NOT_SOLD_HERE:"TIDAK DIJUAL DI SINI",PLAYER_NOT_FOUND:"AKUN BELUM TERSINKRON"};
  return map[m]||m||"SERVER TIDAK MERESPONS";
}
async function bpBuyArt(id){
  const d=ART_DEFS.find(x=>x.id===id);if(!d||state.artOwned.includes(id))return;
  if(d.src&&d.src!=="coin"){toast("TIDAK DIJUAL DI SINI",d.src==="raid"?"BELI DI TOKO WORLD BOSS PAKAI TOKEN":"DROP BASE DI INF TOWER","#fcd34d");return;}
  if((state.coins||0)<d.price){beep(200,.09,"square",.06);toast("COIN KURANG","BUTUH ${coinIcon(15)} "+fmt(d.price),"#f87171");return;}
  /* 0028: beli lewat server — harga & saldo diperiksa di RPC buy_item, jadi
     coin hasil edit F12 ditolak di sini (bukan lagi masuk lokal lalu dibuang). */
  const online=typeof currentUser!=="undefined"&&currentUser&&window.CloudDB&&window.CloudDB.buyItem;
  if(online){
    let res=null;
    try{res=await window.CloudDB.buyItem(currentUser,id);}catch(e){res=null;}
    if(!res||!res.ok){beep(200,.09,"square",.06);toast("TRANSAKSI GAGAL",bpBuyErr(res),"#f87171");return;}
    if(!state.artOwned.includes(id))state.artOwned.push(id);
  }else{
    coinSpend(d.price);state.artOwned.push(id);
  }
  save();
  beep(680,.12,"triangle",.09);setTimeout(()=>beep(900,.12,"triangle",.08),90);
  toast(d.name,luckTxt(d),d.color);renderShell();renderBackpackPanel();
}
function bpToggleArt(id){
  const d=ART_DEFS.find(x=>x.id===id);if(!d||!state.artOwned.includes(id))return;
  const i=state.artSlots.indexOf(id);
  if(i>=0){state.artSlots[i]=null;beep(360,.08,"triangle",.06);toast("DILEPAS",d.name,"#9ca3af");}
  else{let s=state.artSlots.indexOf(null);if(s<0)s=0;state.artSlots[s]=id;beep(680,.12,"triangle",.09);toast("TERPASANG",d.name+" → SLOT "+(s+1),d.color);}
  save();renderShell();renderBackpackPanel();
  if(!battleLive()&&typeof render==="function")render();
}
function bpArtSlot(i){const id=state.artSlots[i];if(id)bpToggleArt(id);}
async function bpBuyPet(id){
  const d=PET_DEFS.find(x=>x.id===id);if(!d||state.petOwned.includes(id))return;
  if(d.src&&d.src!=="coin"){toast("TIDAK DIJUAL DI SINI",d.src==="raid"?"BELI DI TOKO WORLD BOSS PAKAI TOKEN":"DROP BASE DI INF TOWER","#fcd34d");return;}
  if((state.coins||0)<d.price){beep(200,.09,"square",.06);toast("COIN KURANG","BUTUH ${coinIcon(15)} "+fmt(d.price),"#f87171");return;}
  /* 0028: idem bpBuyArt — pembelian coin divalidasi server. */
  const online=typeof currentUser!=="undefined"&&currentUser&&window.CloudDB&&window.CloudDB.buyItem;
  if(online){
    let res=null;
    try{res=await window.CloudDB.buyItem(currentUser,id);}catch(e){res=null;}
    if(!res||!res.ok){beep(200,.09,"square",.06);toast("TRANSAKSI GAGAL",bpBuyErr(res),"#f87171");return;}
    if(!state.petOwned.includes(id))state.petOwned.push(id);
  }else{
    coinSpend(d.price);state.petOwned.push(id);
  }
  save();
  beep(680,.12,"triangle",.09);setTimeout(()=>beep(900,.12,"triangle",.08),90);
  toast(d.name,luckTxt(d),"#7DF9FF");renderShell();renderBackpackPanel();
}
function bpTogglePet(id){
  const d=PET_DEFS.find(x=>x.id===id);if(!d||!state.petOwned.includes(id))return;
  if(state.petEquipped===id){state.petEquipped=null;beep(360,.08,"triangle",.06);toast("PET DILEPAS",d.name,"#9ca3af");}
  else{state.petEquipped=id;beep(680,.12,"triangle",.09);toast("PET AKTIF",d.name+" · "+luckTxt(d),d.color);}
  save();renderShell();renderBackpackPanel();
  if(!battleLive()&&typeof render==="function")render();
}
function lobbyPetHtml(){
  const d=state&&state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;
  if(!d)return"";
  return `<div class="lobby-pet"><img src="${thumbSrc(d.img)}" alt="${d.name}" loading="lazy" decoding="async" onerror="this.parentNode.classList.add('noimg')"><span class="lp-eb">${d.emoji}</span><span class="lp-tip"><b style="color:${d.color}">${d.name}</b><small>${luckTxt(d)}</small></span></div>`;
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
function profHoverBind(){
  if(window.__profHoverBound)return;window.__profHoverBound=true;
  const SEL='.prof-slot[data-hover="card"], #pfAv, .prof-hero-card';
  document.addEventListener("mouseover",e=>{
    const el=e.target.closest&&e.target.closest(SEL);
    if(!el)return;
    const eq=equipped();
    if(eq&&eq.char&&CARDS[eq.char]){
      hoverPlace(eq, el.getBoundingClientRect());
    }
  });
  document.addEventListener("mouseout",e=>{
    const el=e.target.closest&&e.target.closest(SEL);
    if(!el)return;
    const to=e.relatedTarget;
    if(to&&to.closest&&to.closest(SEL)===el)return;
    hoverHide();
  });
}
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
const MASTER_CARD_INDEX=STORY_BIBLE.units.map(u=>({char_id:u.id,name:u.name,tier:(u.noGacha&&!u.chance)?u.tier:null,chance:u.chance||null,type:u.type,base_hp:u.hp,base_atk:u.atk,sprite_asset:u.art,art_image:u.art,pos:u.pos||null,fullArt:!!u.fullArt,passive:{name:u.skill,desc:u.desc},noGacha:!!u.noGacha,weatherOnly:u.weatherOnly||null,raidBoss:!!u.raidBoss,towerBoss:!!u.towerBoss,isStoryEnemy:!!(u.noGacha&&!u.chance)}));

/* =============== PREMIUM SHOP SYSTEM =============== */
var premCurTab = 'all';

var PREMIUM_PACKS = [
  { id: 'global_luck', cat: 'all', type: 'global_luck', name: 'GLOBAL LUCK', price: 1200, img: 'assets/images/weather-potion.webp?v=1', badge: 'SERVER EVENT', color: '#34d399', stats: ['10× SERVER LUCK', 'DURASI 60 MENIT', 'MAX 100×'], desc: 'Aktifkan 10× LUCK untuk SEMUA pemain di server selama 1 JAM! Username kamu akan tampil sebagai aktivator.' },
  // PET & ARTEFAK
  { id: 'tome-infinity', cat: 'equip', type: 'art', name: 'TOME OF INFINITY', price: 3000, img: 'assets/artifacts/tome-infinity.webp?v=1', badge: 'MYTHIC ARTIFACT', color: '#38bdf8', stats: ['+150 FLAT LUCK', '+200% LUCK', 'PERMANEN'], desc: 'Kitab mistis tak terbatas! Memberikan +150 Flat Luck & +200% Luck secara permanen.' },
  { id: 'cyber-kitsune', cat: 'equip', type: 'pet', name: 'CYBER KITSUNE', price: 10000, img: 'assets/pets/cyber-kitsune.webp?v=1', badge: 'SUPREME PET', color: '#f43f5e', stats: ['+250 FLAT LUCK', '+300% LUCK', 'SUPREME TIER'], desc: 'Rubah legendaris masa depan! Memberikan +250 Flat Luck & +300% Luck saat dipasang.' },

  // INSTAN ROLL PACKS
  { id: 'r5k', cat: 'pack', type: 'pack', name: 'INSTAN ROLL 5.000', amount: 5000, price: 25, img: 'assets/images/instanpack-5k.webp?v=trans1', badge: 'STARTER PACK', color: '#38bdf8', stats: ['5.000 PULLS', 'INSTANT LOOT', 'MULTI-BUY'], desc: '5.000 tarikan kartu instan ke dalam inventori Backpack.' },
  { id: 'r10k', cat: 'pack', type: 'pack', name: 'INSTAN ROLL 10.000', amount: 10000, price: 50, img: 'assets/images/instanpack-10k.webp?v=trans1', badge: 'POPULAR PACK', color: '#2dd4bf', stats: ['10.000 PULLS', 'INSTANT LOOT', 'MULTI-BUY'], desc: '10.000 tarikan kartu instan ke dalam inventori Backpack.' },
  { id: 'r25k', cat: 'pack', type: 'pack', name: 'INSTAN ROLL 25.000', amount: 25000, price: 100, img: 'assets/images/instanpack-25k.webp?v=trans1', badge: 'VALUE PACK', color: '#a855f7', stats: ['25.000 PULLS', 'BEST VALUE', 'MULTI-BUY'], desc: '25.000 tarikan kartu instan ke dalam inventori Backpack.' },
  { id: 'r50k', cat: 'pack', type: 'pack', name: 'INSTAN ROLL 50.000', amount: 50000, price: 150, img: 'assets/images/instanpack-50k.webp?v=trans1', badge: 'EPIC PACK', color: '#f59e0b', stats: ['50.000 PULLS', 'HIGH YIELD', 'MULTI-BUY'], desc: '50.000 tarikan kartu instan ke dalam inventori Backpack.' },
  { id: 'r100k', cat: 'pack', type: 'pack', name: 'INSTAN ROLL 100.000', amount: 100000, price: 250, img: 'assets/images/instanpack-100k.webp?v=trans1', badge: 'ULTIMATE PACK', color: '#ec4899', stats: ['100.000 PULLS', 'MAX OVERDRIVE', 'MULTI-BUY'], desc: '100.000 tarikan kartu instan ke dalam inventori Backpack.' },

  // WEATHER INSTAN (Hanya Rare sampai Awakened)
  { id: 'w_eclipse', cat: 'weather', type: 'weather', targetWeather: 'eclipse', name: 'INSTAN ECLIPSE', price: 150, img: 'assets/images/weather-potion.webp?v=1', badge: 'RARE WEATHER', stats: ['+300% LUCK', '+200% SPEED', '30 MENIT'], desc: 'Aktifkan cuaca ECLIPSE instan selama 30 menit! +300% Luck & +200% Roll Speed.' },
  { id: 'w_doodle', cat: 'weather', type: 'weather', targetWeather: 'doodle', name: 'INSTAN DOODLE', price: 200, img: 'assets/images/weather-potion.webp?v=1', badge: 'RARE WEATHER', stats: ['+400% LUCK', '+250% SPEED', '30 MENIT'], desc: 'Aktifkan cuaca DOODLE instan selama 30 menit! +400% Luck & +250% Roll Speed.' },
  { id: 'w_glitch', cat: 'weather', type: 'weather', targetWeather: 'glitch', name: 'INSTAN GLITCH', price: 300, img: 'assets/images/weather-potion.webp?v=1', badge: 'RARE WEATHER', stats: ['+500% LUCK', '+300% SPEED', '30 MENIT'], desc: 'Aktifkan cuaca GLITCH instan selama 30 menit! +500% Luck & +300% Roll Speed.' },
  { id: 'w_goofy', cat: 'weather', type: 'weather', targetWeather: 'goofy', name: 'INSTAN GOOFY', price: 450, img: 'assets/images/weather-potion.webp?v=1', badge: 'RARE WEATHER', stats: ['+600% LUCK', '+350% SPEED', '30 MENIT'], desc: 'Aktifkan cuaca GOOFY instan selama 30 menit! +600% Luck & +350% Roll Speed.' },
  { id: 'w_arcane', cat: 'weather', type: 'weather', targetWeather: 'arcane', name: 'INSTAN ARCANE', price: 750, img: 'assets/images/weather-potion.webp?v=1', badge: 'ARCANE WEATHER', stats: ['+900% LUCK', '+500% SPEED', '30 MENIT'], desc: 'Aktifkan anomali sihir ARCANE instan selama 30 menit! +900% Luck & +500% Roll Speed.' },
  { id: 'w_awakened', cat: 'weather', type: 'weather', targetWeather: 'awakened', name: 'INSTAN AWAKENED', price: 1500, img: 'assets/images/weather-potion.webp?v=1', badge: 'SUPREME AWAKENED', stats: ['+1400% LUCK', '+700% SPEED', '30 MENIT'], desc: 'Kekuatan tertinggi semesta AWAKENED instan selama 30 menit! +1400% Luck & +700% Roll Speed.' }
];

/* ---- Isi popup konfirmasi pembelian item toko premium ---- */
function premConfirmBody(pack, qty) {
  qty = Math.max(1, parseInt(qty, 10) || 1);
  var gemIcon = '<img class="glcf-gem-icon" src="assets/images/premium-currency.webp" alt="" width="16" height="16">';
  var efek = pack.desc || '';
  var labelEfek = 'EFEK';
  var rows = '';
  if (pack.type === 'pack') {
    var totalPull = Number(pack.amount || 0) * qty;
    rows += '<div class="glcf-row"><span class="glcf-label">JUMLAH</span><span class="glcf-val"><b>' + qty + '×</b> paket ' + pack.name + '</span></div>' +
      '<div class="glcf-row"><span class="glcf-label">TARIKAN</span><span class="glcf-val"><b>' + totalPull.toLocaleString('id-ID') + '</b> tarikan kartu instan</span></div>';
    efek = 'Menambah <b>' + totalPull.toLocaleString('id-ID') + '</b> tarikan kartu instan ke dalam Backpack.';
  } else if (pack.type === 'art') {
    efek = 'Artefak permanen masuk Backpack. ' + (pack.desc || '');
  } else if (pack.type === 'pet') {
    efek = 'Pet sakti masuk Backpack. ' + (pack.desc || '');
  } else if (pack.type === 'weather') {
    var wName = (WEATHER[pack.targetWeather] && WEATHER[pack.targetWeather].name) || pack.name;
    labelEfek = 'CUACA SERVER';
    efek = 'Cuaca <b>' + wName + '</b> langsung aktif untuk <b>SEMUA PEMAIN DI SERVER</b> selama <b>30 MENIT</b>. ' + (pack.desc || '');
  }
  var totalPrice = Number(pack.price || 0) * qty;
  return '<div class="glcf-row"><span class="glcf-label">ITEM</span><span class="glcf-val"><b>' + pack.name + '</b>' +
      (pack.badge ? '<span class="glcf-badge">' + pack.badge + '</span>' : '') + '</span></div>' +
    rows +
    '<div class="glcf-row"><span class="glcf-label">' + labelEfek + '</span><span class="glcf-val">' + efek + '</span></div>' +
    '<div class="glcf-row"><span class="glcf-label">HARGA</span><span class="glcf-val">' + gemIcon + ' ' + totalPrice + ' Gems' +
      (qty > 1 ? ' <span style="opacity:.7">(' + pack.price + ' × ' + qty + ')</span>' : '') + '</span></div>' +
    '<div class="glcf-row"><span class="glcf-label">SALDO</span><span class="glcf-val">' + gemIcon + ' ' + fmt(state.premiumGems || 0) + ' Gems</span></div>' +
    '<div class="glcf-warn">Gems langsung dipotong dan <b>tidak bisa dikembalikan</b>.' +
      (pack.type === 'weather' ? ' Cuaca langsung aktif untuk semua pemain di server selama 30 menit.' : '') + '</div>';
}

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
  /* Sinkronkan saldo & inventori premium dari cloud saat membuka toko (tanpa menurunkan saldo/inventori lokal) */
  if (typeof currentUser !== 'undefined' && currentUser && window.CloudDB && typeof window.CloudDB.getUser === 'function') {
    window.CloudDB.getUser(currentUser).then(function(u){
      if (!u || !u.save_data || !state) return;
      var sd = u.save_data;
      var changed = false;
      if (typeof sd.premiumGems === 'number' && sd.premiumGems > (state.premiumGems || 0)) {
        state.premiumGems = sd.premiumGems;
        changed = true;
      }
      if (Array.isArray(sd.artOwned)) {
        state.artOwned = state.artOwned || [];
        sd.artOwned.forEach(function(id){
          if (!state.artOwned.includes(id)) { state.artOwned.push(id); changed = true; }
        });
      }
      if (Array.isArray(sd.petOwned)) {
        state.petOwned = state.petOwned || [];
        sd.petOwned.forEach(function(id){
          if (!state.petOwned.includes(id)) { state.petOwned.push(id); changed = true; }
        });
      }
      if (sd.rollPacks && typeof sd.rollPacks === 'object') {
        state.rollPacks = state.rollPacks || {};
        Object.keys(sd.rollPacks).forEach(function(k){
          if ((sd.rollPacks[k] || 0) > (state.rollPacks[k] || 0)) {
            state.rollPacks[k] = sd.rollPacks[k];
            changed = true;
          }
        });
      }
      if (changed) {
        renderPremiumShop();
        if (typeof renderShell === 'function') renderShell();
      }
    }).catch(function(){});
  }
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

  var statEl = document.getElementById('premSubStat');
  if(statEl) statEl.textContent = filteredPacks.length + ' ITEM TERSEDIA';

  var glNow = (typeof _globalLuckCache !== 'undefined' && _globalLuckCache) ? _globalLuckCache : null;
  var glActive = glNow && glNow.ends_at && (Date.now() < new Date(glNow.ends_at).getTime());
  var glMult = glActive ? (glNow.multiplier || 10) : 0;
  var glMaxed = glMult >= (typeof GLOBAL_LUCK_MAX_MULT !== 'undefined' ? GLOBAL_LUCK_MAX_MULT : 100);

  grid.innerHTML = filteredPacks.map(function(p){
    var isAlreadyOwned = false;
    var ownedTxt = '';
    var statusIcon = '';
    var activeWeatherNow = activeWeatherId();

    var cardCol = p.color || '#ffd700';
    if(p.type === 'weather'){
      cardCol = (WEATHER[p.targetWeather] && WEATHER[p.targetWeather].color) || '#38bdf8';
    }

    if (p.type === 'global_luck') {
      isAlreadyOwned = glMaxed;
      if (glActive) {
        var glRem = fmtCountdown(Math.max(0, new Date(glNow.ends_at).getTime() - Date.now()));
        var glBy = glNow.activated_by ? (' · BY ' + String(glNow.activated_by).toUpperCase()) : '';
        ownedTxt = '<span class="prem-st-live" style="--scol:#34d399"><span class="prem-st-dot"></span>AKTIF: <b>' + glMult + '× LUCK</b> (⏱ ' + glRem + glBy + ')</span>';
      } else {
        ownedTxt = '<span class="prem-st-idle">SIAP DIAKTIFKAN · BUFF 10× SELURUH SERVER</span>';
      }
    } else if (p.type === 'art') {
      isAlreadyOwned = (state.artOwned || []).includes(p.id);
      ownedTxt = isAlreadyOwned
        ? '<span class="prem-st-owned">✓ SUDAH DIMILIKI DI BACKPACK</span>'
        : '<span class="prem-st-idle">ARTEFAK PERMANEN · BELUM DIMILIKI</span>';
    } else if (p.type === 'pet') {
      isAlreadyOwned = (state.petOwned || []).includes(p.id);
      ownedTxt = isAlreadyOwned
        ? '<span class="prem-st-owned">✓ SUDAH DIMILIKI DI BACKPACK</span>'
        : '<span class="prem-st-idle">COMPANION SAKTI · BELUM DIMILIKI</span>';
    } else if (p.type === 'weather') {
      var isCurActive = (activeWeatherNow === p.targetWeather);
      var wDef = WEATHER[p.targetWeather];
      var rem = (isCurActive && state.weather && state.weather.endsAt > Date.now()) ? fmtCountdown(state.weather.endsAt - Date.now()) : '';
      var byWho = (isCurActive && state.weather && state.weather.activated_by) ? (' · OLEH ' + String(state.weather.activated_by).toUpperCase()) : '';
      ownedTxt = isCurActive
        ? '<span class="prem-st-live" style="--scol:' + cardCol + '"><span class="prem-st-dot"></span>AKTIF DI SERVER (⏱ ' + rem + byWho + ')</span>'
        : '<span class="prem-st-idle">ANOMALI CUACA SERVER · DURASI 30 MENIT</span>';
    } else {
      var owned = (state.rollPacks && state.rollPacks[p.id]) || 0;
      ownedTxt = '<span class="prem-st-pack">STOK BACKPACK: <b>' + owned.toLocaleString('id-ID') + ' PACK</b></span>';
    }

    var canAfford = (state.premiumGems || 0) >= p.price;
    var btnCls = (canAfford && !isAlreadyOwned) ? 'prem-buy-btn' : 'prem-buy-btn disabled';
    var btnLabel = isAlreadyOwned
      ? (p.type === 'global_luck' ? 'MAX STACK (100×)' : 'SUDAH DIMILIKI')
      : (p.type === 'global_luck' && glActive
          ? ('TUMPUK +10× · ' + p.price.toLocaleString('id-ID') + ' GEMS')
          : (p.type === 'pack'
              ? ('BELI / MULTI · ' + p.price.toLocaleString('id-ID') + ' GEMS')
              : ('BELI · ' + p.price.toLocaleString('id-ID') + ' GEMS')));

    var statsHtml = '';
    if (Array.isArray(p.stats) && p.stats.length) {
      statsHtml = '<div class="prem-card-chips">' + p.stats.map(function(s, idx){
        return '<span class="prem-chip' + (idx === 0 ? ' pri' : '') + '">' + s + '</span>';
      }).join('') + '</div>';
    }

    var stageContent = '';
    if (p.type === 'weather') {
      stageContent =
        '<div class="prem-wx-stage">' +
          '<div class="prem-wx-halo"></div>' +
          '<img src="' + p.img + '" alt="' + p.name + '" class="prem-card-img prem-wx-bottle">' +
          '<div class="prem-wx-crest">' + weatherSvg(p.targetWeather, 28) + '</div>' +
        '</div>';
    } else if (p.type === 'global_luck') {
      stageContent =
        '<div class="prem-gl-stage">' +
          '<div class="prem-wx-halo"></div>' +
          '<div class="prem-gl-emblem">' + (typeof globalLuckFountainSvg === 'function' ? globalLuckFountainSvg(92) : '<img src="' + p.img + '" class="prem-card-img">') + '</div>' +
          '<span class="prem-gl-mult-tag">+10× LUCK</span>' +
        '</div>';
    } else {
      var imgExtraCls = p.type === 'pack' ? ' prem-pack-img' : (p.type === 'art' || p.type === 'pet' ? ' prem-equip-img' : '');
      stageContent =
        '<div class="prem-std-stage">' +
          '<div class="prem-wx-halo"></div>' +
          '<img src="' + p.img + '" alt="' + p.name + '" class="prem-card-img' + imgExtraCls + '">' +
          (p.type === 'pack' ? '<span class="prem-pack-qty-tag">×1 / ×5 / ×10 / ×25</span>' : '') +
        '</div>';
    }

    var pricePill = '<div class="prem-card-price-tag">' +
      '<img src="assets/images/premium-currency.webp?v=trans1" alt="Gem" width="14" height="14">' +
      '<b>' + p.price.toLocaleString('id-ID') + '</b>' +
    '</div>';

    return '<div class="prem-card prem-type-' + p.type + (isAlreadyOwned ? ' prem-card-owned-full' : '') + '" style="--pcol:' + cardCol + '">' +
      '<div class="prem-card-top">' +
        '<div class="prem-card-badge">' + p.badge + '</div>' +
        pricePill +
      '</div>' +
      '<div class="prem-card-img-wrap">' +
        stageContent +
      '</div>' +
      '<div class="prem-card-info">' +
        '<div class="prem-card-name">' + p.name + '</div>' +
        statsHtml +
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

async function buyPremiumPack(packId, ev, qty){
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
  console.log('[BUY PREMIUM] Starting purchase:', packId, 'type:', pack.type, 'price:', pack.price);

  // Handle global_luck type — delegasi ke buyGlobalLuck() (popup konfirmasi di dalamnya)
  if (pack.type === 'global_luck') {
    await buyGlobalLuck();
    if(btn) btn.disabled = false;
    return;
  }

  /* --- Popup konfirmasi pembelian --- */
  qty = Math.max(1, parseInt(qty, 10) || 1);
  if (pack.type === 'pack') {
    // Paket Instan Pack: popup berisi toggle jumlah beli (×1 / ×5 / ×10 / ×25)
    var QTY_LIST = [1, 5, 10, 25];
    var qtyOptions = QTY_LIST.map(function (q) {
      return {
        label: '×' + q,
        value: String(q),
        body: premConfirmBody(pack, q),
        okText: 'BELI · ' + (Number(pack.price) * q) + ' GEMS'
      };
    });
    var pickedQty = await showConfirmDialog({
      title: 'KONFIRMASI PEMBELIAN',
      body: premConfirmBody(pack, 1),
      okText: 'BELI · ' + pack.price + ' GEMS',
      options: qtyOptions,
      optsLabel: 'JUMLAH PAKET',
      selected: QTY_LIST.indexOf(qty) >= 0 ? String(qty) : '1'
    });
    if (!pickedQty) {
      toast('DIBATALKAN', 'Pembelian dibatalkan', '#94a3b8');
      return;
    }
    qty = parseInt(pickedQty, 10) || 1;
  } else {
    var confirmed = await showConfirmDialog({
      title: 'KONFIRMASI PEMBELIAN',
      body: premConfirmBody(pack, 1),
      okText: 'BELI · ' + pack.price + ' GEMS'
    });
    if (!confirmed) {
      toast('DIBATALKAN', 'Pembelian dibatalkan', '#94a3b8');
      return;
    }
  }

  var totalCost = Number(pack.price || 0) * qty;
  if(btn) { btn.disabled = true; btn.textContent = 'MEMPROSES...'; }

  try {
    var prevWeather = state.weather ? Object.assign({}, state.weather) : null;
    var prevWeatherBest = state.weatherBest || null;
    if(pack.type === 'weather'){
      const wId = pack.targetWeather;
      state.weatherBest = betterWeather(state.weatherBest, wId);
      state.weather = { id: wId, endsAt: Date.now() + WEATHER_ROTATE_MS };
    }

    if(window.CloudDB && typeof window.CloudDB.verifyAndDeductGems === 'function'){
      var res = await window.CloudDB.verifyAndDeductGems(currentUser, totalCost, pack.id, pack.type, qty);
      if(!res.ok){
        if(pack.type === 'weather'){
          state.weather = prevWeather;
          state.weatherBest = prevWeatherBest;
        }
        beep(280,.2,'sawtooth',.12);
        toast('TRANSAKSI GAGAL', res.msg || 'Saldo tidak mencukupi!', '#f87171');
        renderPremiumShop();
        renderShell();
        return;
      }
      state.premiumGems = (typeof res.balance === 'number') ? res.balance : (state.premiumGems - totalCost);
      if(pack.type === 'art'){
        if (Array.isArray(res.artOwned)) state.artOwned = res.artOwned;
        else {
          state.artOwned = state.artOwned || [];
          if(!state.artOwned.includes(pack.id)) state.artOwned.push(pack.id);
        }
      } else if(pack.type === 'pet'){
        if (Array.isArray(res.petOwned)) state.petOwned = res.petOwned;
        else {
          state.petOwned = state.petOwned || [];
          if(!state.petOwned.includes(pack.id)) state.petOwned.push(pack.id);
        }
      } else if(pack.type === 'weather'){
        const wId = pack.targetWeather;
        state.weatherBest = betterWeather(state.weatherBest, wId);
        state.weather = (res && res.weather && typeof res.weather === 'object')
          ? res.weather
          : { id: wId, endsAt: Date.now() + WEATHER_ROTATE_MS };
      } else {
        // Pack (Instan Pack) sudah ditambahkan oleh verifyAndDeductGems (qty) -> jangan dobel.
      }
      save();
    } else {
      if((state.premiumGems || 0) < totalCost){
        if(pack.type === 'weather'){
          state.weather = prevWeather;
          state.weatherBest = prevWeatherBest;
        }
        beep(280,.2,'sawtooth',.12);
        toast('GEMS KURANG', 'Butuh ' + totalCost + ' Gems untuk beli ini!', '#f87171');
        return;
      }
      state.premiumGems -= totalCost;
      if(pack.type === 'art'){
        state.artOwned = state.artOwned || [];
        if(!state.artOwned.includes(pack.id)) state.artOwned.push(pack.id);
      } else if(pack.type === 'pet'){
        state.petOwned = state.petOwned || [];
        if(!state.petOwned.includes(pack.id)) state.petOwned.push(pack.id);
      } else if(pack.type === 'weather'){
        const wId = pack.targetWeather;
        state.weatherBest = betterWeather(state.weatherBest, wId);
        state.weather = (res && res.weather && typeof res.weather === 'object')
          ? res.weather
          : { id: wId, endsAt: Date.now() + WEATHER_ROTATE_MS };
      } else {
        state.rollPacks = state.rollPacks || {};
        state.rollPacks[pack.id] = (state.rollPacks[pack.id] || 0) + qty;
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
      rewardMsg = 'Cuaca ' + (wDef.name || pack.name) + ' AKTIF untuk SEMUA SERVER selama 30 menit!';
      const wEnd = (state.weather && state.weather.endsAt) || (Date.now() + WEATHER_ROTATE_MS);
      const wBuyer = (state.weather && state.weather.activated_by) || currentUser || 'HUNTER';
      const wKey = 'gw:' + pack.targetWeather + ':' + wBuyer + ':' + Math.round(Number(wEnd) / 1000);
      showGlobalEventBroadcast({
        key: wKey,
        color: wDef.color || '#38bdf8',
        badge: 'SERVER EVENT · INSTANT WEATHER',
        title: 'CUACA ' + (wDef.name || pack.name) + ' DIAKTIFKAN!',
        buyer: wBuyer,
        effect: 'BUFF SELURUH SERVER: <b>' + (wDef.luckBonus || 1) + '× LUCK</b> & <b>' + (wDef.speedBonus || 1) + '× ROLL SPEED</b> SELAMA 30 MENIT!',
        iconHtml: weatherSvg(pack.targetWeather, 42)
      });
    } else {
      rewardMsg = '+' + qty + ' ' + pack.name + ' masuk ke Backpack! (' + (Number(pack.amount || 0) * qty).toLocaleString('id-ID') + ' tarikan)!';
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
  // saat auto jalan, wmAutoPaint sudah update; full render cuma bikin animasi per-tick ke-reset
  wmRenderTimer = setInterval(() => { if(!wmAutoRunning) renderWeatherMachine(); }, 1000);
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
  if(!battleLive() && typeof render === "function") render();
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
  /* Loop auto cuma paint header mesin, JAMA rebuild #weatherPanel. Tanpa ini dock
     tetap nampilin cuaca LAMA saat balik ke lobby. Samakan dock dgn state terkini. */
  try{ renderWeatherDock(); renderBuffDock(); }catch(e){}
}

/* wmAutoPaint: update ringan saat auto-loop — tidak re-render seluruh shell/app */
function wmAutoPaint(){
  const aw = activeWeatherId();
  const curDef = (aw && WEATHER[aw]) || WM_NO_WEATHER;
  const pPotCnt = (state && state.potions) || 0;
  const remainingTime = (state && state.weather && state.weather.endsAt && state.weather.endsAt > Date.now())
    ? fmtCountdown(state.weather.endsAt - Date.now())
    : '00:00';

  // update header: cuaca aktif + timer + stok potion
  const headEl = document.getElementById('wmHeadWeather');
  if(headEl){
    headEl.innerHTML = '' +
      '<div class="wm-head-pill wm-cur-badge" style="border-color:' + curDef.color + ';box-shadow:0 0 10px ' + curDef.color + '33">' +
        '<span class="wm-cur-ic" style="color:' + curDef.color + '">' + weatherSvg(aw, 14) + '</span>' +
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
    // ikon + deskripsi pill ikut cuaca yang sedang aktif (sebelumnya beku)
    const pill = curPanel.querySelector('.tc-trait-pill');
    if(pill){
      pill.style.setProperty('--tcol', curDef.color);
      const gw = pill.querySelector('.tc-gem-wrap');
      if(gw) gw.innerHTML = weatherSvg(aw || 'windy', 18);
      const nm = pill.querySelector('.tc-name-glow');
      if(nm) nm.textContent = curDef.desc || (curDef.rar + ' WEATHER');
    }
  }

  // FX per tick: sweep panel + highlight baris cuaca yang aktif + counter
  document.querySelectorAll('.wm-rates-list .trr-item.trr-hit').forEach(el => el.classList.remove('trr-hit'));
  const hitItem = document.querySelector('.wm-rates-list .trr-item.own');
  if(curPanel){ curPanel.classList.remove('wm-tick'); void curPanel.offsetWidth; curPanel.classList.add('wm-tick'); }
  if(hitItem){ void hitItem.offsetWidth; hitItem.classList.add('trr-hit'); }
  const iterPop = document.querySelector('.wm-main .tram-n');
  if(iterPop){ iterPop.classList.remove('tr-n-pop'); void iterPop.offsetWidth; iterPop.classList.add('tr-n-pop'); }

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
    if(!battleLive() && typeof render === "function") render();
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
  const curDef = (aw && WEATHER[aw]) || WM_NO_WEATHER;
  const remainingTime = (state && state.weather && state.weather.endsAt && state.weather.endsAt > Date.now())
    ? fmtCountdown(state.weather.endsAt - Date.now())
    : '00:00';
  const pPotCnt = (state && state.potions) || 0;

  if(headEl){
    headEl.innerHTML = '' +
      '<div class="wm-head-pill wm-cur-badge" style="border-color:' + curDef.color + ';box-shadow:0 0 10px ' + curDef.color + '33">' +
        '<span class="wm-cur-ic" style="color:' + curDef.color + '">' + weatherSvg(aw, 14) + '</span>' +
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
        '<span class="trr-gem" style="color:' + w.color + '">' + weatherSvg(w.id, 13) + '</span>' +
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

  /* Render tiap detik nge-replace innerHTML -> .wm-rates-list dibuat ulang ->
     scrollTop balik 0 (kelihatan "scroll langsung ke atas"). Simpan dulu, restore lagi. */
  const _rlPrev = bodyEl.querySelector('.wm-rates-list');
  const _rlScroll = _rlPrev ? _rlPrev.scrollTop : 0;

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
                '<span class="tc-gem-wrap">' + weatherSvg(aw||'windy', 18) + '</span>' +
                '<span class="tc-name-glow">' + (curDef.desc || (curDef.rar + ' WEATHER')) + '</span>' +
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
  /* Restore posisi scroll daftar probabilitas setelah innerHTML di-rebuild. */
  const _rlNew = bodyEl.querySelector('.wm-rates-list');
  if(_rlNew && _rlScroll) _rlNew.scrollTop = _rlScroll;
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

/* =============== GLOBAL LUCK SYSTEM v2 =============== */
const GLOBAL_LUCK_COST        = 1200;
const GLOBAL_LUCK_STEP_MULT   = 10;
const GLOBAL_LUCK_MAX_MULT    = 100;
const GLOBAL_LUCK_STEP_MS     = 3600000;   // 1 jam per stack
const GLOBAL_LUCK_MAX_MS      = 36000000;  // max 10 jam

let _globalLuckCache     = null;  // cache hasil poll
let _globalLuckPollTimer = null;  // timer poll
let _glWidgetTimer       = null;  // timer countdown widget

/* ---- SVG Icon Cyber Clover / Golden Star Luck Crest (bukan air) ---- */
function globalLuckFountainSvg(sz) {
  sz = sz || 30;
  return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<defs>' +
      '<radialGradient id="glGlowGrad" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#ffd700" stop-opacity="0.55"/>' +
        '<stop offset="60%" stop-color="#10b981" stop-opacity="0.22"/>' +
        '<stop offset="100%" stop-color="#10b981" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<linearGradient id="glLeafGrad" x1="6" y1="6" x2="30" y2="30" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%" stop-color="#fde047"/>' +
        '<stop offset="45%" stop-color="#34d399"/>' +
        '<stop offset="100%" stop-color="#059669"/>' +
      '</linearGradient>' +
      '<linearGradient id="glGoldRim" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%" stop-color="#fffbeb"/>' +
        '<stop offset="50%" stop-color="#ffd700"/>' +
        '<stop offset="100%" stop-color="#f59e0b"/>' +
      '</linearGradient>' +
    '</defs>' +
    '<circle cx="18" cy="18" r="16" fill="url(#glGlowGrad)"/>' +
    '<polygon points="18,2.5 31.5,10.2 31.5,25.8 18,33.5 4.5,25.8 4.5,10.2" stroke="url(#glGoldRim)" stroke-width="1.2" stroke-opacity="0.55" fill="rgba(6,78,59,0.35)"/>' +
    '<path d="M18 16.5 C15 11.5 10.5 8.5 13 6 C15 4 17.5 6 18 8.5 C18.5 6 21 4 23 6 C25.5 8.5 21 11.5 18 16.5 Z" fill="url(#glLeafGrad)" stroke="url(#glGoldRim)" stroke-width="0.9"/>' +
    '<path d="M18 19.5 C15 24.5 10.5 27.5 13 30 C15 32 17.5 30 18 27.5 C18.5 30 21 32 23 30 C25.5 27.5 21 24.5 18 19.5 Z" fill="url(#glLeafGrad)" stroke="url(#glGoldRim)" stroke-width="0.9"/>' +
    '<path d="M16.5 18 C11.5 15 8.5 10.5 6 13 C4 15 6 17.5 8.5 18 C6 18.5 4 21 6 23 C8.5 25.5 11.5 21 16.5 18 Z" fill="url(#glLeafGrad)" stroke="url(#glGoldRim)" stroke-width="0.9"/>' +
    '<path d="M19.5 18 C24.5 15 27.5 10.5 30 13 C32 15 30 17.5 27.5 18 C30 18.5 32 21 30 23 C27.5 25.5 24.5 21 19.5 18 Z" fill="url(#glLeafGrad)" stroke="url(#glGoldRim)" stroke-width="0.9"/>' +
    '<path d="M18 12.5 L19.4 16.6 L23.5 18 L19.4 19.4 L18 23.5 L16.6 19.4 L12.5 18 L16.6 16.6 Z" fill="url(#glGoldRim)"/>' +
    '<circle cx="18" cy="18" r="1.8" fill="#ffffff"/>' +
    '<circle cx="9" cy="8.5" r="1" fill="#fde047" opacity=".9"/>' +
    '<circle cx="27.5" cy="9.5" r="1.1" fill="#fde047" opacity=".9"/>' +
    '<circle cx="8.5" cy="27" r="0.9" fill="#34d399" opacity=".85"/>' +
    '<circle cx="27" cy="27.5" r="1" fill="#fde047" opacity=".85"/>' +
    '</svg>';
}

/* ---- Fetch dari Supabase ---- */
async function fetchGlobalLuck() {
  if (!window.CloudDB) return null;
  try {
    const data = await window.CloudDB.getGlobalLuck();
    _globalLuckCache = data;
    return data;
  } catch(e) { return null; }
}

/* ---- Multiplier aktif (1 jika tidak aktif) ---- */
function globalLuckMult() {
  if (!_globalLuckCache) return 1;
  if (Date.now() >= new Date(_globalLuckCache.ends_at).getTime()) {
    _globalLuckCache = null;
    return 1;
  }
  return _globalLuckCache.multiplier || 1;
}

/* ---- Render widget di backpack (return HTML string) ---- */
function renderGlobalLuckWidget() {
  const gl     = _globalLuckCache;
  const now    = Date.now();
  const active = gl && now < new Date(gl.ends_at).getTime();
  const gems   = (typeof state !== 'undefined' && state.premiumGems) || 0;
  const canBuy = gems >= GLOBAL_LUCK_COST;
  const mult   = active ? (gl.multiplier || 0) : 0;
  const stacks = active ? Math.round(mult / GLOBAL_LUCK_STEP_MULT) : 0;
  const maxed  = mult >= GLOBAL_LUCK_MAX_MULT;

  let timerStr = '';
  if (active) {
    const msLeft = new Date(gl.ends_at).getTime() - now;
    const s = Math.max(0, Math.floor(msLeft / 1000));
    const pad = function(x){ return String(x).padStart(2,'0'); };
    const hh = Math.floor(s / 3600);
    const mm = Math.floor(s % 3600 / 60);
    const ss = s % 60;
    timerStr = hh > 0 ? (pad(hh)+':'+pad(mm)+':'+pad(ss)) : (pad(mm)+':'+pad(ss));
  }

  /* Ikon resmi mata uang premium (bukan emoji) */
  const gemIcon = '<img class="glw-gem-icon" src="assets/images/premium-currency.webp" alt="" width="13" height="13">';
  const btnLabel = active
    ? (maxed ? 'MAX 100×' : '+10× · ' + gemIcon + GLOBAL_LUCK_COST)
    : 'AKTIFKAN · ' + gemIcon + GLOBAL_LUCK_COST;
  const btnDisabled = !canBuy || maxed;
  const btnClass = 'glw-btn' + (active && !maxed ? ' stack' : '') + (maxed ? ' maxed' : '');

  const rawBuyer = String((gl && gl.activated_by) ? gl.activated_by : 'HUNTER');
  const buyerSafe = rawBuyer.replace(/[&<>"']/g, function(c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
  const titleBadge = active
    ? '<span class="glw-live-pill"><span class="glw-live-dot"></span>' + stacks + '/10 STACK</span>'
    : '<span class="glw-idle-pill">OFFLINE</span>';

  const statusHtml = active
    ? ('<div class="glw-active-grid">'
       + '<div class="glw-stat-row">'
         + '<span class="glw-mult">' + mult + '× LUCK</span>'
         + '<span class="glw-timer-pill">⏱ <span class="glw-timer" id="glWidgetTimer">' + timerStr + '</span></span>'
       + '</div>'
       + '<div class="glw-buyer-pill" title="Diaktifkan oleh ' + buyerSafe + '">'
         + '<span class="glw-buyer-ic">👑</span>'
         + '<span class="glw-buyer-lbl">BY:</span>'
         + '<span class="glw-buyer-name">' + buyerSafe.toUpperCase() + '</span>'
       + '</div>'
     + '</div>')
    : '<span class="glw-off">Buff keberuntungan seluruh server (+10×/stack)</span>';
  const statusClass = 'glw-status' + (active ? ' active' : '');
  const wrapClass = 'glw-wrap' + (active ? ' is-active' : '');

  return '<div class="' + wrapClass + '" id="glLobbyWidget">'
    + '<div class="glw-main-row">'
      + '<div class="glw-icon">' + globalLuckFountainSvg(30) + '</div>'
      + '<div class="glw-info">'
        + '<div class="glw-head-row">'
          + '<div class="glw-title">GLOBAL LUCK</div>'
          + titleBadge
        + '</div>'
        + '<div class="' + statusClass + '">' + statusHtml + '</div>'
      + '</div>'
      + '<button class="' + btnClass + '" id="glBuyBtn" onclick="buyGlobalLuck()"'
        + (btnDisabled ? ' disabled' : '') + '>' + btnLabel + '</button>'
    + '</div>'
  + '</div>';
}

/* ---- Ticker countdown widget (update tiap detik) ---- */
function _startGlWidgetTick() {
  if (_glWidgetTimer) return;
  _glWidgetTimer = setInterval(function() {
    var el = document.getElementById('glWidgetTimer');
    if (!el) { clearInterval(_glWidgetTimer); _glWidgetTimer = null; return; }
    var gl = _globalLuckCache;
    if (!gl) { el.textContent = ''; return; }
    var msLeft = new Date(gl.ends_at).getTime() - Date.now();
    if (msLeft <= 0) {
      _globalLuckCache = null;
      clearInterval(_glWidgetTimer); _glWidgetTimer = null;
      if (typeof renderBackpackPanel === 'function') renderBackpackPanel();
      if (typeof renderShell === 'function') renderShell();
      return;
    }
    var s = Math.floor(msLeft / 1000);
    var pad = function(x){ return String(x).padStart(2,'0'); };
    var hh = Math.floor(s / 3600);
    var mm = Math.floor(s % 3600 / 60);
    var ss = s % 60;
    el.textContent = hh > 0 ? (pad(hh)+':'+pad(mm)+':'+pad(ss)) : (pad(mm)+':'+pad(ss));
  }, 1000);
}

/* ---- Polling 15 detik ----
   Render penuh hanya kalau data GLOBAL LUCK benar-benar berubah dan tidak ada
   modal terbuka. Sebelumnya tiap 15 detik lobby/backpack dibangun ulang sia-sia. */
function _glKey() {
  var g = _globalLuckCache;
  return g ? (g.ends_at + '|' + g.multiplier + '|' + (g.activated_by || '')) : 'none';
}
function _uiModalOpen() {
  try {
    var ix = document.getElementById('indexModal');
    if (ix && ix.classList.contains('show')) return true;
    var bp = document.getElementById('backpackPanel');
    if (bp && bp.style.display && bp.style.display !== 'none') return true;
    var sp = document.getElementById('skillPop');
    if (sp && sp.classList.contains('show')) return true;
  } catch (e) {}
  return false;
}
function startGlobalLuckPoll() {
  if (_globalLuckPollTimer) return;
  fetchGlobalLuck().then(function(gl) {
    if (gl && gl.ends_at && gl.multiplier) {
      _markGlobalBroadcastSeen('gl:' + gl.multiplier + ':' + (gl.activated_by || '') + ':' + gl.ends_at);
    }
    if (typeof render === 'function' && !battleLive() && !_uiModalOpen()) render();
    _startGlWidgetTick();
  });
  _globalLuckPollTimer = setInterval(async function() {
    if(document.hidden)return;
    var before = _glKey();
    var gl = await fetchGlobalLuck();
    var after = _glKey();
    var changed = after !== before;
    if (changed && gl && gl.multiplier && gl.ends_at && Date.now() < new Date(gl.ends_at).getTime()) {
      var stacks = Math.round((gl.multiplier || 10) / GLOBAL_LUCK_STEP_MULT);
      showGlobalEventBroadcast({
        key: 'gl:' + gl.multiplier + ':' + (gl.activated_by || '') + ':' + gl.ends_at,
        color: '#34d399',
        badge: 'SERVER EVENT · GLOBAL LUCK SHRINE',
        title: 'GLOBAL LUCK ' + gl.multiplier + '× AKTIF!',
        buyer: gl.activated_by || 'HUNTER',
        effect: 'SELURUH SERVER MENDAPATKAN <b>' + gl.multiplier + '× LUCK (' + stacks + ' TUMPUK)</b> UNTUK SEMUA PEMAIN!',
        iconHtml: globalLuckFountainSvg(44)
      });
    }
    if (changed && typeof render === 'function' && !battleLive() && !_uiModalOpen()) render();
    if (changed && typeof renderShell === 'function') renderShell();
    _startGlWidgetTick();
  }, 10000);
}

/* ---- Stub banner lama (no-op — widget sekarang di backpack) ---- */
function renderGlobalLuckBanner() {
  var el = document.getElementById('globalLuckBanner');
  if (el) el.remove();
}

/* ---- Popup konfirmasi generik (promise-based) ----
 * opts: { title, body, okText, options:[{label,value,body,okText}], selected }
 * resolve: true (tanpa options) atau nilai option yang dipilih (dengan options). */
function showConfirmDialog(opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    var host = document.getElementById('glConfirmHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'glConfirmHost';
      document.body.appendChild(host);
    }
    var options = opts.options || [];
    var selected = opts.selected !== undefined ? opts.selected : (options.length ? options[0].value : null);

    function bodyHTML() {
      if (!options.length) return opts.body || '';
      var cur = null;
      for (var i = 0; i < options.length; i++) { if (options[i].value === selected) { cur = options[i]; break; } }
      return (cur && cur.body) || opts.body || '';
    }
    function okText() {
      if (!options.length) return opts.okText || 'AKTIFKAN';
      var cur = null;
      for (var i = 0; i < options.length; i++) { if (options[i].value === selected) { cur = options[i]; break; } }
      return (cur && cur.okText) || opts.okText || 'BELI';
    }

    var optHTML = options.length
      ? '<div class="glcf-opts">' + options.map(function (o) {
          return '<button type="button" class="glcf-opt' + (o.value === selected ? ' on' : '') + '" data-val="' + o.value + '">' + o.label + '</button>';
        }).join('') + '</div>'
      : '';

    host.innerHTML =
      '<div class="glcf-backdrop">' +
        '<div class="glcf-box">' +
          '<div class="glcf-title">' + (opts.title || 'KONFIRMASI') + '</div>' +
          (optHTML ? '<div class="glcf-opts-wrap">' +
            (opts.optsLabel ? '<div class="glcf-opts-label">' + opts.optsLabel + '</div>' : '') + optHTML + '</div>' : '') +
          '<div class="glcf-body">' + bodyHTML() + '</div>' +
          '<div class="glcf-actions">' +
            '<button class="glcf-btn glcf-btn--cancel" type="button">BATAL</button>' +
            '<button class="glcf-btn glcf-btn--ok" type="button">' + okText() + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    function close(val) {
      host.innerHTML = '';
      document.removeEventListener('keydown', onKey);
      resolve(val);
    }
    function onKey(e) { if (e.key === 'Escape') close(options.length ? null : false); }
    document.addEventListener('keydown', onKey);
    host.querySelector('.glcf-btn--cancel').onclick = function () { close(options.length ? null : false); };
    host.querySelector('.glcf-btn--ok').onclick = function () { close(options.length ? selected : true); };
    host.querySelector('.glcf-backdrop').onclick = function (e) { if (e.target === this) close(options.length ? null : false); };

    var optWrap = host.querySelector('.glcf-opts-wrap');
    if (optWrap) {
      optWrap.querySelectorAll('.glcf-opt').forEach(function (b) {
        b.onclick = function () {
          selected = b.getAttribute('data-val');
          optWrap.querySelectorAll('.glcf-opt').forEach(function (x) { x.classList.toggle('on', x === b); });
          host.querySelector('.glcf-body').innerHTML = bodyHTML();
          host.querySelector('.glcf-btn--ok').textContent = okText();
        };
      });
    }
  });
}
window.showConfirmDialog = showConfirmDialog;

/* ---- Beli / Stack Global Luck ---- */
async function buyGlobalLuck() {
  const btn = document.getElementById('glBuyBtn');
  if (btn) btn.disabled = true;
  try {
    if ((state.premiumGems || 0) < GLOBAL_LUCK_COST) {
      toast('GEMS TIDAK CUKUP', 'Butuh ' + GLOBAL_LUCK_COST + ' Gems', '#f87171');
      return;
    }

    const existing = await fetchGlobalLuck();
    if (existing && (existing.multiplier || 0) >= GLOBAL_LUCK_MAX_MULT) {
      toast('SUDAH MAX STACK', 'Global Luck sudah 100× — tidak bisa ditambah lagi', '#fcd34d');
      return;
    }

    const username = currentUser || 'GUEST';
    const isStack = !!existing;
    const prevMult = existing ? (existing.multiplier || 0) : 0;
    let newMult = Math.min(prevMult + GLOBAL_LUCK_STEP_MULT, GLOBAL_LUCK_MAX_MULT);

    /* --- Popup konfirmasi sebelum membeli --- */
    const gemIcon = '<img class="glcf-gem-icon" src="assets/images/premium-currency.webp" alt="" width="16" height="16">';
    const confirmBody =
      '<div class="glcf-row"><span class="glcf-label">AKUN</span><span class="glcf-val">' + username + '</span></div>' +
      '<div class="glcf-row"><span class="glcf-label">EFEK</span><span class="glcf-val">' +
        (isStack
          ? 'Tumpukan ke <b>' + newMult + '× LUCK</b> (dari ' + prevMult + '×)'
          : 'Aktifkan <b>' + newMult + '× LUCK</b> untuk semua pemain') +
      '</span></div>' +
      '<div class="glcf-row"><span class="glcf-label">DURASI</span><span class="glcf-val">+1 JAM per aktivasi (maks. 10 jam)</span></div>' +
      '<div class="glcf-row"><span class="glcf-label">HARGA</span><span class="glcf-val">' + gemIcon + ' ' + GLOBAL_LUCK_COST + ' Gems</span></div>' +
      '<div class="glcf-row"><span class="glcf-label">SALDO</span><span class="glcf-val">' + gemIcon + ' ' + (state.premiumGems || 0) + ' Gems</span></div>' +
      '<div class="glcf-warn">Gems langsung dipotong dan <b>tidak bisa dikembalikan</b>. Aktivasi berlaku untuk seluruh server.</div>';

    const ok = await showConfirmDialog({
      title: isStack ? 'TUMPUK GLOBAL LUCK' : 'AKTIVASI GLOBAL LUCK',
      body: confirmBody,
      okText: isStack ? 'TUMPUK' : 'AKTIFKAN'
    });
    if (!ok) {
      toast('DIBATALKAN', 'Pembelian Global Luck dibatalkan', '#94a3b8');
      return;
    }

    /* Bayar + aktifkan lewat SATU RPC atomik (server yang potong gem &
       hitung multiplier/durasi — lihat migration 0016). Jika di localhost/guest/CG preview
       sesi cloud tidak tersedia tapi saldo lokal mencukupi, gunakan fallback lokal agar
       pembelian tetap berfungsi mulus. */
    let res = null;
    if (window.CloudDB && typeof window.CloudDB.buyGlobalLuck === 'function') {
      try {
        res = await window.CloudDB.buyGlobalLuck(username);
      } catch (e) {
        console.warn('[buyGlobalLuck] Cloud RPC error, using local fallback:', e);
      }
    }
    if (!res || !res.ok) {
      if ((state.premiumGems || 0) >= GLOBAL_LUCK_COST) {
        const prevEndsMs = (existing && existing.ends_at) ? Math.max(Date.now(), new Date(existing.ends_at).getTime()) : Date.now();
        const nextEndsMs = Math.min(Date.now() + GLOBAL_LUCK_MAX_MS, prevEndsMs + GLOBAL_LUCK_STEP_MS);
        state.premiumGems = Math.max(0, (state.premiumGems || 0) - GLOBAL_LUCK_COST);
        res = {
          ok: true,
          balance: state.premiumGems,
          multiplier: newMult,
          ends_at: new Date(nextEndsMs).toISOString(),
          activated_by: username
        };
      } else {
        toast('GAGAL', (res && res.msg) || 'Transaksi gagal', '#f87171');
        return;
      }
    }
    newMult = res.multiplier;
    state.premiumGems = res.balance;
    save();

    // Cache dari nilai SERVER / lokal agar semua UI sinkron.
    _globalLuckCache = {
      id: existing ? existing.id : null,
      activated_by: res.activated_by || username,
      activated_at: (existing && existing.activated_at) || new Date().toISOString(),
      ends_at: res.ends_at,
      multiplier: res.multiplier
    };

    beep(720, 0.2, 'triangle', 0.12);
    setTimeout(function(){ beep(960, 0.25, 'triangle', 0.14); }, 100);
    setTimeout(function(){ beep(1200, 0.2, 'triangle', 0.12); }, 200);

    const stacks = Math.round(newMult / GLOBAL_LUCK_STEP_MULT);
    toast('🍀 GLOBAL LUCK AKTIF!', newMult + '× luck (' + stacks + ' tumpuk) untuk semua server!', '#34d399');
    showGlobalEventBroadcast({
      key: 'gl:' + newMult + ':' + (res.activated_by || username) + ':' + res.ends_at,
      color: '#34d399',
      badge: 'SERVER EVENT · GLOBAL LUCK SHRINE',
      title: 'GLOBAL LUCK ' + newMult + '× AKTIF!',
      buyer: res.activated_by || username,
      effect: 'SELURUH SERVER MENDAPATKAN <b>' + newMult + '× LUCK (' + stacks + ' TUMPUK)</b> UNTUK SEMUA PEMAIN!',
      iconHtml: globalLuckFountainSvg(44)
    });

    if (typeof renderPremiumShop === 'function') renderPremiumShop();
    if (typeof render === 'function' && !battleLive()) render();
    if (typeof renderShell === 'function') renderShell();
    _startGlWidgetTick();
  } catch(err) {
    console.error('[buyGlobalLuck]', err);
    toast('ERROR', err.message, '#f87171');
  } finally {
    if (btn) btn.disabled = false;
  }
}

window.buyGlobalLuck          = buyGlobalLuck;
window.globalLuckMult         = globalLuckMult;
window.startGlobalLuckPoll    = startGlobalLuckPoll;
window.fetchGlobalLuck        = fetchGlobalLuck;
window.renderGlobalLuckBanner = renderGlobalLuckBanner;
window.renderGlobalLuckWidget = renderGlobalLuckWidget;

/* =============== TOP-UP GEMS MODAL =============== */
/* id dipakai server (Edge Function) sebagai sumber kebenaran harga & gems.
 * Harus identik dengan supabase/functions/_shared/packs.ts (server = sumber kebenaran). */
const TOPUP_PACKS = [
  { id: 'p100',  gems: 100,  price: '10.000',  label: null,         bonus: null, productId: 'gems_100' },
  { id: 'p500',  gems: 500,  price: '50.000',  label: null,         bonus: null, productId: 'gems_500' },
  { id: 'p1000', gems: 1000, price: '100.000', label: 'POPULAR',    bonus: null, productId: 'gems_1000' },
  { id: 'p2500', gems: 2500, price: '250.000', label: null,         bonus: null, productId: 'gems_2500' },
  { id: 'p5000', gems: 5000, price: '500.000', label: 'BEST VALUE', bonus: null, productId: 'gems_5000' },
];
window.TOPUP_PACKS = {};
TOPUP_PACKS.forEach(function(p){ window.TOPUP_PACKS[p.id] = p; });

/* Slug kelas CSS untuk badge: "BEST VALUE" -> "best-value" (tanpa spasi),
 * supaya kelas .topup-badge--best-value benar-benar|style-nya match. */
function topupBadgeClass(label) {
  return 'topup-badge--' + String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* Ikon resmi mata uang premium (dipakai juga di pill header global). */
const TOPUP_GEM_ICON = 'assets/images/premium-currency.webp';

function topupGemIconHTML(size, cls) {
  return '<img class="' + (cls || '') + '" src="' + TOPUP_GEM_ICON + '" alt="" width="' + size + '" height="' + size + '">';
}

/* Build Android (Capacitor) => top-up lewat Google Play Billing.
 * Build web => top-up lewat Trakteer Shop (QRIS/VA) + kode redeem. */
function isNativeBuild() {
  return (typeof window.__AAB_BUILD__ !== 'undefined' && window.__AAB_BUILD__ === 'android')
      || (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}
window.IS_NATIVE_BUILD = isNativeBuild;

function renderTopupModal() {
  const modal = document.getElementById('topupModal');
  if (!modal) return;

  const gems = state.premiumGems || 0;

  /* Web build: top-up dimatikan (hanya Android / Google Play Billing). */
  const native = isNativeBuild();
  const tab = window.TOPUP_TAB || (native ? 'play' : 'shop');

  const tabsHTML =
    '<div class="topup-tabs">' +
      '<button class="topup-tab' + (tab === 'shop' ? ' is-active' : '') + '" type="button" data-topup-tab="shop">BELI GEMS</button>' +
      '<button class="topup-tab' + (tab === 'code' ? ' is-active' : '') + '" type="button" data-topup-tab="code">PUNYA KODE</button>' +
    '</div>';

  if (!native) {
    let bodyHTML = '';
    if (tab === 'code') {
      bodyHTML =
        '<div class="topup-code-box">' +
          '<label class="topup-code-label" for="topupCodeInput">Masukkan kode redeem dari Trakteer</label>' +
          '<div class="topup-code-row">' +
            '<input id="topupCodeInput" class="topup-code-input" type="text" autocomplete="off" spellcheck="false" placeholder="ACB-XXXX-XXXX-XXXX">' +
            '<button class="topup-redeem-btn" id="topupRedeemBtn" type="button">TUKAR</button>' +
          '</div>' +
          '<p class="topup-note">Kode redeem dibeli di Trakteer Shop. Satu kode hanya bisa dipakai 1x.</p>' +
        '</div>';
    } else {
      const shopPackHTML = TOPUP_PACKS.map(function(p) {
        const badgeHTML = p.label
          ? '<span class="topup-badge ' + topupBadgeClass(p.label) + '">' + p.label + '</span>'
          : '';
        const bonusHTML = p.bonus ? '<span class="topup-bonus">' + p.bonus + ' BONUS</span>' : '';
        return (
          '<div class="topup-card' + (p.label ? ' topup-card--featured' : '') + '">' +
            badgeHTML +
            topupGemIconHTML(30, 'topup-card-gem-icon') +
            '<div class="topup-card-gems">' + p.gems.toLocaleString('id-ID') + '<span class="topup-card-gems-label"> Gems</span></div>' +
            bonusHTML +
            '<div class="topup-card-price">Rp ' + p.price + '</div>' +
            '<button class="topup-buy-btn" onclick="Topup.openShop(\'' + p.id + '\')">BELI DI TRAKTEER</button>' +
          '</div>'
        );
      }).join('');
      bodyHTML =
        '<div class="topup-grid">' + shopPackHTML + '</div>' +
        '<p class="topup-note">Pembayaran lewat Trakteer Shop (QRIS / Virtual Account). Setelah pembayaran, kode redeem dikirim ke Anda &#8212; masukkan di tab <b>PUNYA KODE</b>.</p>';
    }

    modal.innerHTML =
      '<div class="topup-inner">' +
        '<button class="topup-close" onclick="closeTopup()" title="Tutup">&times;</button>' +
        '<div class="topup-header">' +
          '<div class="topup-header-icon">' + topupGemIconHTML(38, '') + '</div>' +
          '<div class="topup-header-text">' +
            '<div class="topup-title">TOP-UP GEMS</div>' +
            '<div class="topup-balance">Saldo kamu: <span class="topup-balance-val" id="topupBalanceVal">' + gems.toLocaleString('id-ID') + '</span> Gems</div>' +
          '</div>' +
        '</div>' +
        '<div id="topupStatusBox" class="topup-status-box"></div>' +
        tabsHTML +
        bodyHTML +
      '</div>';

    modal.querySelectorAll('.topup-tab').forEach(function(btn) {
      btn.onclick = function() {
        window.TOPUP_TAB = btn.getAttribute('data-topup-tab');
        renderTopupModal();
      };
    });

    const rbtn = document.getElementById('topupRedeemBtn');
    if (rbtn) {
      rbtn.onclick = function() { window.Topup.redeem(); };
      const inp = document.getElementById('topupCodeInput');
      if (inp) {
        inp.onkeydown = function(e) { if (e.key === 'Enter') { e.preventDefault(); window.Topup.redeem(); } };
      }
    }
    return;
  }

  const packHTML = TOPUP_PACKS.map(function(p) {
    const badgeHTML = p.label
      ? '<span class="topup-badge ' + topupBadgeClass(p.label) + '">' + p.label + '</span>'
      : '';
    const bonusHTML = p.bonus
      ? '<span class="topup-bonus">' + p.bonus + ' BONUS</span>'
      : '';
    return (
      '<div class="topup-card' + (p.label ? ' topup-card--featured' : '') + '">' +
        badgeHTML +
        topupGemIconHTML(30, 'topup-card-gem-icon') +
        '<div class="topup-card-gems">' + p.gems.toLocaleString('id-ID') + '<span class="topup-card-gems-label"> Gems</span></div>' +
        bonusHTML +
        '<div class="topup-card-price">Rp ' + p.price + '</div>' +
        '<button class="topup-buy-btn" onclick="Topup.buy(\'' + p.id + '\')">BELI SEKARANG</button>' +
      '</div>'
    );
  }).join('');

  modal.innerHTML =
    '<div class="topup-inner">' +
      '<button class="topup-close" onclick="closeTopup()" title="Tutup">&times;</button>' +
      '<div class="topup-header">' +
        '<div class="topup-header-icon">' + topupGemIconHTML(38, '') + '</div>' +
        '<div class="topup-header-text">' +
          '<div class="topup-title">TOP-UP GEMS</div>' +
          '<div class="topup-balance">Saldo kamu: <span class="topup-balance-val" id="topupBalanceVal">' + gems.toLocaleString('id-ID') + '</span> Gems</div>' +
        '</div>' +
      '</div>' +
      '<div id="topupStatusBox" class="topup-status-box"></div>' +
      '<div class="topup-grid">' + packHTML + '</div>' +
      '<p class="topup-note">Pembayaran lewat Google Play Billing. Gems masuk otomatis setelah pembelian terverifikasi.</p>' +
    '</div>';
}

/* PAYWALL OFF (rilis itch.io bebas P2W): Gems hanya dari grinding.
   Set window.TOPUP_ENABLED = true untuk menghidupkan lagi top-up. */
window.TOPUP_ENABLED = false;

function openTopup() {
  if (!window.TOPUP_ENABLED) {
    try { toast('TOP-UP DINONAKTIFKAN', 'Gems didapat dari grinding: Tower, Boss Raid & Story.', '#ffd700'); } catch (e) {}
    return;
  }
  const modal = document.getElementById('topupModal');
  if (!modal) return;
  renderTopupModal();
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeTopup() {
  const modal = document.getElementById('topupModal');
  if (modal) modal.classList.remove('show');
  document.body.style.overflow = '';
}

/* Top-up nyata: alur invoice + polling ada di js/topup.js (window.Topup).
 * Fungsi ini kept sebagai alias biar panggilan lama tidak error. */
async function buyTopup(gemsAmount) {
  if (!window.TOPUP_ENABLED) {
    try { toast('TOP-UP DINONAKTIFKAN', 'Gems didapat dari grinding: Tower, Boss Raid & Story.', '#ffd700'); } catch (e) {}
    return;
  }
  if (window.Topup && typeof window.Topup.buy === 'function') {
    const pack = TOPUP_PACKS.find(function(p){ return p.gems === gemsAmount; });
    if (pack) return window.Topup.buy(pack.id);
  }
  toast('ERROR', 'Modul top-up belum siap. Muat ulang halaman.', '#f87171');
}

// Tutup modal kalau klik backdrop
document.addEventListener('click', function(e) {
  const modal = document.getElementById('topupModal');
  if (modal && modal.classList.contains('show') && e.target === modal) {
    closeTopup();
  }
});

window.openTopup  = openTopup;
window.closeTopup = closeTopup;
window.buyTopup   = buyTopup;

/* =============== FLOATING DAILY 7-DAY LOGIN & WATCH ADS REWARD SYSTEM ===============
 * 1. Menampilkan 2 ikon mengambang (Floating Dock) di samping kanan widget Global Luck:
 *    - 7-Day Login (dengan titik merah notif jika hari ini belum diklaim)
 *    - Watch Ads (dengan badge status READY / ACTIVE)
 * 2. Modal Watch Ads berisi 2 Reward:
 *    - 2× LUCK BOOST (aktif 5 menit di modal & Buff Dock; bisa ditonton lagi setelah buff 5 menit habis)
 *    - INSTAN PACK 100K (langsung menarik 100.000 roll kartu instan; cooldown 30 menit sebelum bisa ditonton lagi)
 */
const AD_LUCK_DURATION_MS = 5 * 60 * 1000;   // 5 menit
const AD_PACK_COOLDOWN_MS = 30 * 60 * 1000;  // 30 menit
const AD_WATCH_SIM_SEC    = 5;               // 5 detik simulasi tayangan iklan

function _adStorageKey() {
  var u = (typeof currentUser !== 'undefined' && currentUser) ? String(currentUser).toLowerCase() : 'guest';
  return 'acb_ad_rewards_v1:' + u;
}

function _loadAdState() {
  var st = (typeof state !== 'undefined' && state) ? state : null;
  var raw = null;
  try { raw = JSON.parse(localStorage.getItem(_adStorageKey()) || 'null'); } catch (e) {}
  var luckEndsAt = Math.max(
    (st && typeof st.adLuckEndsAt === 'number') ? st.adLuckEndsAt : 0,
    (raw && typeof raw.luckEndsAt === 'number') ? raw.luckEndsAt : 0
  );
  var packCdEndsAt = Math.max(
    (st && typeof st.adPackCdEndsAt === 'number') ? st.adPackCdEndsAt : 0,
    (raw && typeof raw.packCdEndsAt === 'number') ? raw.packCdEndsAt : 0
  );
  if (st) {
    st.adLuckEndsAt = luckEndsAt;
    st.adPackCdEndsAt = packCdEndsAt;
  }
  return { luckEndsAt: luckEndsAt, packCdEndsAt: packCdEndsAt };
}

function _saveAdState(luckEndsAt, packCdEndsAt) {
  var st = (typeof state !== 'undefined' && state) ? state : null;
  if (st) {
    if (typeof luckEndsAt === 'number') st.adLuckEndsAt = luckEndsAt;
    if (typeof packCdEndsAt === 'number') st.adPackCdEndsAt = packCdEndsAt;
  }
  try {
    var cur = _loadAdState();
    var next = {
      luckEndsAt: typeof luckEndsAt === 'number' ? luckEndsAt : cur.luckEndsAt,
      packCdEndsAt: typeof packCdEndsAt === 'number' ? packCdEndsAt : cur.packCdEndsAt
    };
    localStorage.setItem(_adStorageKey(), JSON.stringify(next));
  } catch (e) {}
  try { if (typeof save === 'function') save(); } catch (e) {}
}

function adLuckLeftMs() {
  var d = _loadAdState();
  return Math.max(0, (d.luckEndsAt || 0) - Date.now());
}

function adPackCdLeftMs() {
  var d = _loadAdState();
  return Math.max(0, (d.packCdEndsAt || 0) - Date.now());
}

function adLuckMult() {
  return adLuckLeftMs() > 0 ? 2 : 1;
}

window.adLuckLeftMs   = adLuckLeftMs;
window.adPackCdLeftMs = adPackCdLeftMs;
window.adLuckMult     = adLuckMult;

function renderLobbyFloatingIcons() {
  var dailyReady = false;
  try {
    if (typeof state !== 'undefined' && state && typeof todayStr === 'function') {
      dailyReady = state.lastClaim !== todayStr();
    }
  } catch (e) {}

  var luckMs = adLuckLeftMs();
  var packMs = adPackCdLeftMs();
  var adsReady = (luckMs <= 0) || (packMs <= 0);

  var calendarSvg = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<rect x="3" y="4" width="18" height="18" rx="3"/>'
    + '<line x1="16" y1="2" x2="16" y2="6"/>'
    + '<line x1="8" y1="2" x2="8" y2="6"/>'
    + '<line x1="3" y1="10" x2="21" y2="10"/>'
    + '<path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" stroke-width="2.6"/>'
    + '</svg>';

  var adsSvg = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<rect x="2" y="5" width="20" height="14" rx="3"/>'
    + '<polygon points="10 9 15 12 10 15 10 9" fill="currentColor"/>'
    + '</svg>';

  return '<div class="hub-float-dock" id="hubFloatDock">'
    + '<button type="button" class="hfd-btn hfd-daily' + (dailyReady ? ' is-ready' : '') + '" onclick="if(typeof sfx!==\'undefined\'&&sfx.hit)sfx.hit();openDaily()" title="7-Day Login Reward">'
      + (dailyReady ? '<span class="hfd-dot"></span>' : '')
      + '<span class="hfd-ic">' + calendarSvg + '</span>'
      + '<span class="hfd-lbl">7-DAY</span>'
    + '</button>'
    + '<button type="button" class="hfd-btn hfd-ads' + (luckMs > 0 ? ' is-active' : (adsReady ? ' is-ready' : '')) + '" onclick="if(typeof sfx!==\'undefined\'&&sfx.hit)sfx.hit();openWatchAdsModal()" title="Watch Ads — Free 2× Luck & Instant Pack 100K">'
      + (adsReady ? '<span class="hfd-dot ads"></span>' : '')
      + '<span class="hfd-ic">' + adsSvg + '</span>'
      + '<span class="hfd-lbl" id="hfdAdsLbl">' + (luckMs > 0 ? '2× ON' : 'FREE ADS') + '</span>'
    + '</button>'
  + '</div>';
}
window.renderLobbyFloatingIcons = renderLobbyFloatingIcons;

var _watchAdsModalTimer = null;
var _watchingAdBusy = false;

function ensureWatchAdsModal() {
  var m = document.getElementById('watchAdsModal');
  if (m) return m;
  m = document.createElement('div');
  m.id = 'watchAdsModal';
  m.className = 'wad-backdrop';
  m.addEventListener('click', function(e) {
    if (e.target === m && !_watchingAdBusy) closeWatchAdsModal();
  });
  document.body.appendChild(m);
  return m;
}

function openWatchAdsModal() {
  var m = ensureWatchAdsModal();
  renderWatchAdsModal();
  m.classList.add('show');
  if (_watchAdsModalTimer) clearInterval(_watchAdsModalTimer);
  _watchAdsModalTimer = setInterval(function() {
    if (!m.classList.contains('show')) {
      clearInterval(_watchAdsModalTimer);
      _watchAdsModalTimer = null;
      return;
    }
    if (!_watchingAdBusy) tickWatchAdsModal();
  }, 1000);
}

function closeWatchAdsModal() {
  if (_watchingAdBusy) return;
  var m = document.getElementById('watchAdsModal');
  if (m) m.classList.remove('show');
  if (_watchAdsModalTimer) {
    clearInterval(_watchAdsModalTimer);
    _watchAdsModalTimer = null;
  }
}

window.openWatchAdsModal  = openWatchAdsModal;
window.closeWatchAdsModal = closeWatchAdsModal;

function renderWatchAdsModal() {
  var m = ensureWatchAdsModal();
  var luckMs = adLuckLeftMs();
  var packMs = adPackCdLeftMs();
  var luckActive = luckMs > 0;
  var packOnCd   = packMs > 0;

  var luckStatusHtml = luckActive
    ? '<div class="wad-status-pill active"><span class="wad-live-dot"></span>AKTIF DI MODAL · SISA <b id="wadLuckTimer">' + fmtCountdown(luckMs) + '</b></div>'
    : '<div class="wad-status-pill ready">SIAP DITONTON · DURASI 5 MENIT</div>';

  var packStatusHtml = packOnCd
    ? '<div class="wad-status-pill cd">COOLDOWN · SIAP DALAM <b id="wadPackTimer">' + fmtCountdown(packMs) + '</b></div>'
    : '<div class="wad-status-pill ready">SIAP DITONTON · REFRESH TIAP 30 MENIT</div>';

  m.innerHTML = ''
    + '<div class="wad-box">'
      + '<div class="wad-glow-top"></div>'
      + '<div class="wad-head">'
        + '<div class="wad-head-left">'
          + '<div class="wad-eyebrow"><span class="wad-pulse"></span>SPONSORED TERMINAL · FREE REWARDS</div>'
          + '<h2 class="wad-title">WATCH ADS REWARD</h2>'
        + '</div>'
        + '<button type="button" class="ix-x" onclick="closeWatchAdsModal()" title="Tutup">✕</button>'
      + '</div>'
      + '<div class="wad-subbanner">'
        + 'Tonton iklan singkat untuk mengaktifkan <b>2× Total Luck</b> selama 5 menit atau klaim <b>Instan Roll Pack 100K</b> gratis!'
      + '</div>'
      + '<div id="wadPlayerSlot" class="wad-player-slot" style="display:none"></div>'
      + '<div class="wad-grid">'
        /* CARD 1: 2x LUCK 5 MINUTES */
        + '<div class="wad-card luck' + (luckActive ? ' is-active' : '') + '" id="wadCardLuck">'
          + '<div class="wad-card-ribbon">REFRESH 5 MENIT</div>'
          + '<div class="wad-card-main">'
            + '<div class="wad-ic-box luck">'
              + '<img src="assets/images/pot-luck-3.webp" alt="2x Luck" onerror="this.style.display=\'none\'">'
              + '<span class="wad-ic-badge">2×</span>'
            + '</div>'
            + '<div class="wad-info">'
              + '<div class="wad-card-title">2× LUCK OVERDRIVE</div>'
              + '<div class="wad-card-desc">Menggandakan (<b>×2</b>) total keberuntunganmu selama <b>5 menit</b> penuh. Bisa ditonton lagi segera setelah durasi buff 5 menit habis!</div>'
              + '<div id="wadLuckStatusWrap">' + luckStatusHtml + '</div>'
            + '</div>'
          + '</div>'
          + '<button type="button" class="wad-btn luck' + (luckActive ? ' disabled' : '') + '" id="wadBtnLuck" onclick="triggerWatchAd(\'luck\')"' + (luckActive ? ' disabled' : '') + '>'
            + (luckActive
              ? ('<span>⏳ AKTIF (' + fmtCountdown(luckMs) + ')</span>')
              : '<span>🎬 TONTON IKLAN · AKTIFKAN 2× LUCK</span>')
          + '</button>'
        + '</div>'

        /* CARD 2: INSTAN PACK 100K (30 MIN COOLDOWN) */
        + '<div class="wad-card pack' + (packOnCd ? ' is-cd' : '') + '" id="wadCardPack">'
          + '<div class="wad-card-ribbon gold">COOLDOWN 30 MENIT</div>'
          + '<div class="wad-card-main">'
            + '<div class="wad-ic-box pack">'
              + '<img src="assets/images/instanpack-100k.webp?v=trans1" alt="Instan Pack 100K" onerror="this.style.display=\'none\'">'
              + '<span class="wad-ic-badge gold">100K</span>'
            + '</div>'
            + '<div class="wad-info">'
              + '<div class="wad-card-title">INSTAN ROLL PACK 100K</div>'
              + '<div class="wad-card-desc">Langsung mendapatkan & membuka <b>100.000 tarikan kartu instan</b> sekaligus! Bisa ditonton kembali setiap <b>30 menit</b>.</div>'
              + '<div id="wadPackStatusWrap">' + packStatusHtml + '</div>'
            + '</div>'
          + '</div>'
          + '<button type="button" class="wad-btn pack' + (packOnCd ? ' disabled' : '') + '" id="wadBtnPack" onclick="triggerWatchAd(\'pack100k\')"' + (packOnCd ? ' disabled' : '') + '>'
            + (packOnCd
              ? ('<span>⏳ TUNGGU ' + fmtCountdown(packMs) + '</span>')
              : '<span>🎬 TONTON IKLAN · KLAIM PACK 100K</span>')
          + '</button>'
        + '</div>'
      + '</div>'
    + '</div>';

  if (window.GameLang && typeof window.GameLang.refresh === 'function') {
    window.GameLang.refresh();
  }
}

function tickWatchAdsModal() {
  var luckMs = adLuckLeftMs();
  var packMs = adPackCdLeftMs();

  var lt = document.getElementById('wadLuckTimer');
  var pt = document.getElementById('wadPackTimer');
  var bl = document.getElementById('wadBtnLuck');
  var bp = document.getElementById('wadBtnPack');

  // Jika state berubah dari aktif -> habis, re-render penuh modal
  if ((lt && luckMs <= 0) || (!lt && luckMs > 0) || (pt && packMs <= 0) || (!pt && packMs > 0)) {
    renderWatchAdsModal();
    if (typeof renderShell === 'function') renderShell();
    return;
  }

  if (lt && luckMs > 0) lt.textContent = fmtCountdown(luckMs);
  if (bl && luckMs > 0) {
    var isEn = (window.GameLang && window.GameLang.get() === 'en');
    bl.innerHTML = '<span>⏳ ' + (isEn ? 'ACTIVE' : 'AKTIF') + ' (' + fmtCountdown(luckMs) + ')</span>';
  }
  if (pt && packMs > 0) pt.textContent = fmtCountdown(packMs);
  if (bp && packMs > 0) {
    var isEn2 = (window.GameLang && window.GameLang.get() === 'en');
    bp.innerHTML = '<span>⏳ ' + (isEn2 ? 'WAIT ' : 'TUNGGU ') + fmtCountdown(packMs) + '</span>';
  }
}

/* CrazyGames SDK v3 Helper Initialization */
var _cgSdkReady = false;
async function initCrazyGamesSdk() {
  try {
    if (window.CrazyGames && window.CrazyGames.SDK) {
      await window.CrazyGames.SDK.init();
      _cgSdkReady = true;
      console.log("[CrazyGames SDK] Initialized successfully");
    }
  } catch (e) {
    console.warn("[CrazyGames SDK] Init error / running outside portal:", e && e.message);
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCrazyGamesSdk);
} else {
  initCrazyGamesSdk();
}

function triggerWatchAd(kind) {
  if (_watchingAdBusy) return;
  if (kind === 'luck' && adLuckLeftMs() > 0) {
    toast('BUFF MASIH AKTIF', 'Tunggu durasi 5 menit selesai untuk menonton lagi.', '#fbbf24');
    return;
  }
  if (kind === 'pack100k' && adPackCdLeftMs() > 0) {
    toast('MASIH COOLDOWN', 'Tunggu ' + fmtCountdown(adPackCdLeftMs()) + ' lagi untuk klaim Pack 100K.', '#fbbf24');
    return;
  }

  // 1. Prioritas Utama: Jika CrazyGames SDK aktif di portal CrazyGames
  if (window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.ad) {
    try {
      _watchingAdBusy = true;
      var wasMuted = (typeof state !== 'undefined' && state && state.muted);
      var callbacks = {
        adStarted: () => {
          if (typeof state !== 'undefined' && state) state.muted = true;
        },
        adFinished: () => {
          if (typeof state !== 'undefined' && state) state.muted = wasMuted;
          _watchingAdBusy = false;
          completeWatchAdReward(kind);
        },
        adError: (error) => {
          if (typeof state !== 'undefined' && state) state.muted = wasMuted;
          _watchingAdBusy = false;
          console.warn("[CrazyGames Ad Error]", error);
          // Fallback ke simulasi timer jika iklan belum terisi di portal
          runWatchAdSimulation(kind);
        }
      };
      window.CrazyGames.SDK.ad.requestAd('rewarded', callbacks);
      return;
    } catch (err) {
      console.warn("[CrazyGames Ad requestAd exception]", err);
    }
  }

  // 2. Fallback: Simulasi timer (untuk pengujian di localhost / dev)
  runWatchAdSimulation(kind);
}
window.triggerWatchAd = triggerWatchAd;

function runWatchAdSimulation(kind) {
  _watchingAdBusy = true;
  var slot = document.getElementById('wadPlayerSlot');
  var bLuck = document.getElementById('wadBtnLuck');
  var bPack = document.getElementById('wadBtnPack');
  if (bLuck) bLuck.disabled = true;
  if (bPack) bPack.disabled = true;

  var secLeft = AD_WATCH_SIM_SEC;
  if (slot) {
    slot.style.display = 'block';
    var renderPlayer = function() {
      var pct = Math.round(((AD_WATCH_SIM_SEC - secLeft) / AD_WATCH_SIM_SEC) * 100);
      slot.innerHTML = ''
        + '<div class="wad-sim-screen">'
          + '<div class="wad-sim-top">'
            + '<span class="wad-sim-tag">🎬 SPONSORED BROADCAST</span>'
            + '<span class="wad-sim-timer">REWARD DALAM ' + secLeft + 's</span>'
          + '</div>'
          + '<div class="wad-sim-Headline">'
            + (kind === 'luck' ? '🍀 MENYIAPKAN 2× LUCK OVERDRIVE (5 MENIT)…' : '📦 MENYIAPKAN INSTAN ROLL PACK 100K…')
          + '</div>'
          + '<div class="wad-sim-bar"><i style="width:' + pct + '%"></i></div>'
        + '</div>';
      if (window.GameLang && typeof window.GameLang.refresh === 'function') window.GameLang.refresh();
    };
    renderPlayer();

    var iv = setInterval(function() {
      secLeft--;
      if (secLeft > 0) {
        renderPlayer();
      } else {
        clearInterval(iv);
        _watchingAdBusy = false;
        if (slot) { slot.style.display = 'none'; slot.innerHTML = ''; }
        completeWatchAdReward(kind);
      }
    }, 1000);
  } else {
    _watchingAdBusy = false;
    completeWatchAdReward(kind);
  }
}

function completeWatchAdReward(kind) {
  var now = Date.now();
  if (kind === 'luck') {
    _saveAdState(now + AD_LUCK_DURATION_MS, null);
    try { if (typeof sfx !== 'undefined' && sfx.win) sfx.win(); } catch (e) {}
    toast('2× LUCK AKTIF (5 MENIT)!', 'Total keberuntunganmu digandakan ×2 selama 5 menit!', '#4ade80');
    renderWatchAdsModal();
    if (typeof renderShell === 'function') renderShell();
    if (typeof renderLobby === 'function' && typeof route === 'function' && route() === '#/lobby' && !battleLive()) {
      var lbl = document.getElementById('hfdAdsLbl');
      if (lbl) lbl.textContent = '2× ON';
    }
  } else if (kind === 'pack100k') {
    _saveAdState(null, now + AD_PACK_COOLDOWN_MS);
    try { if (typeof sfx !== 'undefined' && sfx.win) sfx.win(); } catch (e) {}
    renderWatchAdsModal();
    closeWatchAdsModal();
    var pulls = 100000;
    var loot = (typeof instantRollFast === 'function') ? instantRollFast(pulls, true) : [];
    if (typeof showTowerLoot === 'function') {
      showTowerLoot(loot, { weather: 0, luck: 0, speed: 0 }, 'REWARD WATCH ADS · 100,000 ROLL');
    }
    toast('INSTAN PACK 100K DITERIMA!', '100.000 tarikan kartu instan berhasil dibuka!', '#ffd700');
    if (typeof renderShell === 'function') renderShell();
  } else if (kind === 'gems') {
    if (typeof state !== 'undefined' && state) {
      state.premiumGems = (state.premiumGems || 0) + 25;
      if (typeof save === 'function') save();
    }
    try { if (typeof sfx !== 'undefined' && sfx.win) sfx.win(); } catch (e) {}
    toast('FREE REWARD CLAIMED!', '+25 GEMS DITERIMA DARI CRAZYGAMES REWARD!', '#7df9ff');
    if (typeof renderPremiumShop === 'function') renderPremiumShop();
    if (typeof renderShell === 'function') renderShell();
  }
}


