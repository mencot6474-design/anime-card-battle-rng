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
const WEATHER_POTION_IDS = new Set([
  'awakened','arcane','goofy','glitch','doodle','eclipse',
  'iceage','galactic','aurora','monsoon','sandstorm',
  'thunderstorm','snowfall','lightrain','windy','clear'
]);
function weatherPotionSrc(id, thumb){
  const file = (id && WEATHER_POTION_IDS.has(id))
    ? 'assets/images/weather-' + id + '.webp'
    : 'assets/images/weather-potion.webp';
  if(thumb && typeof thumbSrc === 'function') return thumbSrc(file) + '?v=1';
  return file + '?v=1';
}
function weatherMachineIconHtml(id){
  return '<i class="wm-halo" aria-hidden="true"></i>' +
    '<img class="wm-pot-img" src="' + weatherPotionSrc(id, true) + '" alt="" decoding="async">';
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
    const pDetail = isLuck ? ("+" + (r.flat||0) + " FLAT" + (r.pct ? " & +" + Math.round(r.pct*100) + "%" : "") + " (+5 MIN)") : ("+" + (r.add||0).toFixed(1) + "x SPEED (+5 MIN)");
    if(typeof toast === "function") toast(pName +  " ACTIVATED", pDetail, "#38bdf8");
    if(typeof renderBuffDock === "function") renderBuffDock();
    if(typeof renderShell === "function") renderShell();
    return r;
  } else {
    if(typeof beep === "function") beep(240, 0.12, "square", 0.08);
    if(typeof toast === "function") toast("POTION STOCK EMPTY", "Buy or earn Potions in the Infinite Shop / Raid Shop / Tower!", "#f87171");
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
      <span class="wp-ic" style="color:${w.color}"><img src="${weatherPotionSrc(w.id, true)}" alt="" width="18" height="18" decoding="async"></span>
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
          <span class="idx-art"><img src="${thumbSrc(c.sprite_asset)}" alt="" decoding="async"></span>
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
      `2× TOTAL LUCK · ${fmtCountdown(adMs)} left`,adMs);
  }
  ls.forEach(b=>{
    const lTxt=b.lv>0?"L"+b.lv+" ":"";
    const p=b.pct||0;
    html+=chip("luck","assets/images/pot-luck-"+b.lv+".webp","🍀",
      `LUCK ${lTxt}POTION`.trim(),
      `+${b.flat||0} FLAT${p>0?` · +${Math.round(p*100)}%`:""} LUCK · ${fmtCountdown(b.endsAt-now)} left`,b.endsAt-now);
  });
  ss.forEach(b=>{
    const lTxt=b.lv>0?"L"+b.lv+" ":"";
    html+=chip("speed","assets/images/pot-speed-"+b.lv+".webp","⚡",
      `SPEED ${lTxt}POTION`.trim(),
      `+${(b.add||0).toFixed(1)}× SPEED · ${fmtCountdown(b.endsAt-now)} left`,b.endsAt-now);
  });
  el.innerHTML=html;
  el.classList.add("show");
}
function toast(main,sub,color){
  /* Hazard notification stack (js/notify-hazard.js). Legacy signature kept: toast(main, sub, color). */
  const col=color||"#38bdf8";
  try {
    if(typeof sfx!=="undefined"&&sfx&&typeof sfx.pop==="function") sfx.pop();
    else if(typeof beep==="function") beep(620,.08,"sine",.04);
  } catch(e) {}
  if(typeof window.hzNotify!=="function")return;
  const html=/^\s*</.test(String(main));
  const plain=html?String(main).replace(/<[^>]*>/g,"").trim():String(main);
  window.hzNotify({
    kind:window.hzKindOf?window.hzKindOf(col):"info",
    color:col,
    title:html?main:plain,
    html:html,
    msg:sub?String(sub).replace(/<[^>]*>/g,""):"",
    key:"t:"+plain+"|"+(sub||""),
    dur:(sub&&String(sub).length>30)?4200:3400
  });
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
  if (typeof window.hzCinematic !== "function") return;
  const isLuck = opts.kind === "luck";
  const WX_PARTICLES = { monsoon:"rain", lightrain:"rain", thunderstorm:"storm", sandstorm:"sand", windy:"sand", snowfall:"snow", iceage:"snow", aurora:"aurora" };
  window.hzCinematic({
    kind: isLuck ? "luck" : (WX_PARTICLES[opts.weatherId] || "luck"),
    color: opts.color || (isLuck ? "#f3e600" : "#38bdf8"),
    kick: isLuck ? "// PREMIUM <b>GLOBAL LUCK</b> ACTIVATED" : "// PREMIUM <b>WEATHER POTION</b> ACTIVATED",
    name: opts.name || opts.title || "GLOBAL BUFF",
    mult: opts.mult || "",
    sub: opts.sub || "",
    buyer: opts.buyer || "HUNTER",
    foot: isLuck ? "LUCK ONLINE" : "WEATHER SYNC",
    iconHtml: opts.iconHtml || "",
    chips: isLuck ? (opts.chips || "") : ""
  });
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
              kind: "weather", weatherId: wDef.id, name: wDef.name, mult: wDef.luckBonus + "\u00d7 LUCK \u00b7 " + wDef.speedBonus + "\u00d7 SPEED", sub: "SERVER-WIDE FOR 30 MINUTES", title: wDef.name + " ACTIVATED!",
              buyer: gw.activated_by,
              effect: `SERVER-WIDE BUFF: <b>${wDef.luckBonus}× LUCK</b> & <b>${wDef.speedBonus}× ROLL SPEED</b> FOR 30 MINUTES!`,
              iconHtml: weatherSvg(wDef.id, 42)
            });
          }
        }else if(!silent&&prevId!==gw.id){
          toast(`<span style="display:inline-flex;align-items:center;gap:8px">${weatherSvg(wDef.id,22)} ${wDef.name}</span>`,"SERVER WEATHER ROTATION · 30 MIN",wDef.color);
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
  const S=(typeof passShinyMult==="function"&&passShinyMult()>0)?passShinyMult():1;
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
  const K=rollCommonScale(S); /* Fix A+B: common discale biar Σ peluang pool = 100% */
  let total=0;
  const weights=entries.map(e=>{const w=((e.ch>=ROLL_RARE_DEN?L:K)/e.ch)*(e.shiny?S:1);total+=w;return w;});
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
let rollState = { active: false, interval: null, currentCard: null, luck: 1, speedMultiplier: 1, hideTimer: null, fadeTimer: null, hideOverlay: false, showcase: null };
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
  const inheritedTrait = (typeof charTraitOf === "function") ? charTraitOf(charId) : "none";
  const ns = { id: Math.random().toString(36).slice(2, 9), char: charId, tier: card.tier, fav: false, lock: false, mut: m, shiny: sh, trait: inheritedTrait, count: 1 };
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
  const total=(typeof MASTER_CARD_INDEX!=="undefined"?MASTER_CARD_INDEX.filter(c=>!c.isStoryEnemy).length:0)*10;
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
    if(!r){ toast("INDEX REWARD","SERVER CONNECTION LOST · TRY AGAIN","#f87171"); return; }
    if(!r.ok){
      const ms=Math.max(1,Number(r.milestone)||IDX_MILESTONE);
      const need=Math.max(0,ms-((Number(r.owned)||0)%ms));
      toast("NOT CLAIMABLE YET","Server: collect "+need+" more index variants!","#f87171");
      if(typeof ixRender==="function")ixRender();
      return;
    }
    const gain=Math.max(1,Number(r.gain)||1);
    beep(640,.16,"triangle",.09);setTimeout(()=>beep(960,.22,"triangle",.08),120);
    toast("INDEX REWARD CLAIMED!","+"+gain+" INSTANT ROLL 5.000 PACK · CHECK BACKPACK","#FFD700");
    if(typeof ixRender==="function")ixRender();
    return;
  }
  /* Jalur lokal hanya untuk guest (tidak ada save di server yang bisa dicuri). */
  const P=idxProgress();
  const gain=P.blocks-P.claimed;
  if(gain<=0){
    toast("NOT CLAIMABLE YET","Collect 15 index variants to claim!","#f87171");
    return;
  }
  state.idxRewardsClaimed=P.blocks;
  state.rollPacks=state.rollPacks||{};
  state.rollPacks.r5k=(state.rollPacks.r5k||0)+gain;
  save();
  beep(640,.16,"triangle",.09);setTimeout(()=>beep(960,.22,"triangle",.08),120);
  toast("INDEX REWARD CLAIMED!","+"+gain+" INSTANT ROLL 5.000 PACK · CHECK BACKPACK","#FFD700");
  if(typeof ixRender==="function")ixRender();
}
window.claimIndexReward=claimIndexReward;
/* Versi cepat instantRoll untuk jumlah besar: bobot tiap varian dibangun SEKALI,
   pemilihan lewat binary search prefix (bukan rngRoll berulang) — 100k roll dalam hitungan detik.
   agg=true -> hasil digabung per varian (pakai r.n) supaya multiplies besar tidak meledakkan memori. */
function instantRollFast(n, agg){
  if(!(n>0))return [];
  const L=(typeof totalLuck==="function"&&totalLuck()>0)?totalLuck():1;
  const S=(typeof passShinyMult==="function"&&passShinyMult()>0)?passShinyMult():1;
  const aw=activeWeatherId();
  const pool=gachaPool();
  const MUTS=["none","gold","rainbow","secret","ultima"];
  const K=rollCommonScale(S); /* Fix A+B — bobot WAJIB sama persis dengan rngRoll */
  const entries=[];const cum=[];let total=0;
  for(const c of pool){
    const base=c.chance||chanceOf(c.tier);
    for(const shiny of [false,true])for(const mut of MUTS){
      const statMult=(shiny?SHINY_MULT:1)*(MUT_MULT[mut]||1);
      const chanceMult=(shiny?SHINY_CHANCE_MULT:1)*(MUT_CHANCE_MULT[mut]||1);
      const ch=base*chanceMult;
      total+=((ch>=ROLL_RARE_DEN?L:K)/ch)*(shiny?S:1); /* Fix A+B — sama dengan bobot rngRoll */
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
  if (typeof toast === "function") toast("SERVER ROLL BUSY", "Sambungan ke server terputus — roll dijeda sebentar.", "#f87171");
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
  if (rollBtn) {
    rollBtn.classList.add('active');
    /* Label tombol ROLL = STOP selama roll berjalan (perintah user 2026-11-06).
       Ditulis di sini, bukan hanya lewat CSS, supaya teks yang dibaca screen
       reader / i18n ikut berubah. Nilai idle dikembalikan di
       stopRollAnimation(). */
    const rt = rollBtn.querySelector('.roll-txt');
    if (rt) rt.textContent = 'STOP';
  }
  const ra = document.getElementById('rollAutoBtn');
  if (ra) {
    ra.classList.add('on');
    /* aria-pressed = sumber benar status AUTO. tower-lobby.js paintAuto()
       membaca atribut ini tiap render; tanpa itu ia menghapus kelas .on yang
       baru dipasang (spin indikator jadi tidak pernah tampil). */
    ra.setAttribute('aria-pressed', 'true');
  }
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
  if(!rollState.active||rollState.showcase)return;
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
  if(!rollState.active||rollState.showcase)return;
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
  if(!rollState.showcase)srScheduleNext();
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
  if (rollBtn) {
    rollBtn.classList.remove('active');
    const rt = rollBtn.querySelector('.roll-txt');
    if (rt) rt.textContent = 'SUMMON';
  }
  const ra = document.getElementById('rollAutoBtn');
  if (ra) {
    ra.classList.remove('on');
    ra.setAttribute('aria-pressed', 'false');
  }
}

/* ===== REVEAL + ANOMALY SHOWCASE (port _tmp/proto_reveal_v1.html — TANPA partikel) =====
   Badge = chip deck; border = bahasa Card Index; skill = passive.name + skillText (i18n-aware).
   Showcase trigger effChance >= 1e15 (1 in 1q): auto-roll DI-PAUSE sampai CLAIM. */
const RV_SHOWCASE_DEN = 1e15;
const RV_SFX = {
  whoosh: 'assets/audio/reveal/whoosh-magic.mp3',
  slam: 'assets/audio/reveal/impact-deep.mp3',
  sparkle: 'assets/audio/reveal/glitter-shot.mp3',
  epic: 'assets/audio/reveal/epic-trailer.mp3',
  claim: 'assets/audio/reveal/success-fantasy.mp3'
};
const _rvPool = {};
function rvSnd(key, vol) {
  if (typeof state !== 'undefined' && state && state.muted) return;
  try {
    const src = RV_SFX[key]; if (!src) return;
    let a = _rvPool[key];
    if (!a) { a = _rvPool[key] = new Audio(src); a.preload = 'auto'; }
    a.volume = Math.min(1, Math.max(0, vol == null ? .6 : vol));
    a.currentTime = 0;
    const p = a.play(); if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}
function rvEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function rvBandOf(eff) {
  if (eff >= RV_SHOWCASE_DEN) return { label: 'ANOMALY // PROBABILITY BREACH', color: '#f3e600' };
  if (eff >= 1e12) return { label: 'ULTRA RARE SIGNAL', color: '#FF0055' };
  if (eff >= 1e9) return { label: 'EPIC SIGNAL', color: '#A855F7' };
  if (eff >= 1e6) return { label: 'RARE SIGNAL', color: '#E0BC6E' };
  return { label: 'SIGNAL ACQUIRED', color: '#f5f5f5' };
}
function rvBadgesHTML(mut, shiny) {
  let h = '';
  if (shiny) h += (typeof shinyStampHtml === 'function') ? shinyStampHtml(false, 'bchip') : '<span class="bchip" style="--c:#7DF9FF">SHINY</span>';
  if (mut !== 'none') h += (typeof mutStampHtml === 'function') ? mutStampHtml(mut, false, 'bchip') : `<span class="bchip" style="--c:${MUT_COLOR[mut]}">${mutText(mut, MUT_LABEL[mut])}</span>`;
  return h || '<span class="bchip" style="--c:rgba(245,245,245,.4)">BASE VARIANT</span>';
}
function rvCardHTML(c, mut, shiny, eff) {
  const mc = mut !== 'none' ? 'm-' + mut : '';
  const hzCls = (typeof hzBorderCls === 'function') ? hzBorderCls(mut, !!shiny) : '';
  const hzLayers = (typeof hzBorderLayerHtml === 'function') ? hzBorderLayerHtml() : '';
  const st = (shiny ? (typeof shinyStampHtml === 'function' ? shinyStampHtml(true) : '') : '')
    + (mut !== 'none' ? (typeof mutStampHtml === 'function' ? mutStampHtml(mut, true) : '') : '');
  const name = (shiny && (mut === 'none' || mut === 'gold'))
    ? `<span class="cn silver">${rvEsc(c.name)}</span>`
    : `<span class="cn">${mutText(mut, c.name)}</span>`;
  return `<div class="cbadges">${rvBadgesHTML(mut, shiny)}</div>
  <div class="cframe ${mc}${shiny ? ' shiny' : ''}${hzCls}">
    ${hzLayers}
    ${st ? `<div class="cframe-stamps">${st}</div>` : ''}
    <img src="${rvEsc(c.art_image || c.sprite_asset)}" alt="${rvEsc(c.name)}" decoding="async">
    <div class="cplate">
      <div class="ct">${rvEsc(c.type)}${shiny ? ' · SHINY' : ''}</div>
      ${name}
      <div class="cc">1 IN ${fmtChance(eff)}</div>
    </div>
  </div>`;
}
function rvSkillHTML(c) {
  const pas = c.passive || {};
  return `<div class="skillblock">
    <div class="sk">PASSIVE SKILL</div>
    <div class="sn">${rvEsc(pas.name || '')}</div>
    <p class="sd">${rvEsc(skillText(c.char_id))}</p>
  </div>`;
}
function rvStatsHTML(c, mut, shiny) {
  const st = cardStats(c.char_id, mut, 'none', shiny);
  return `<div class="rv-stats">
    <div class="rv-stat"><i>HP</i><b>${fmtStat(st.hp)}</b></div>
    <div class="rv-stat"><i>ATK</i><b>${fmtStat(st.atk)}</b></div>
  </div>`;
}
function rvMetaHTML(c, mut, shiny, eff) {
  const band = rvBandOf(eff);
  return `<div class="rv-kicker" style="--bandc:${band.color}">${band.label}</div>
  <div class="rv-chance" style="--bandc:${band.color}">1 IN <b>${fmtChance(eff)}</b></div>
  <div class="rv-full">1 IN ${Math.round(eff).toLocaleString('en-US')} · ${rvEsc(c.type).toUpperCase()} CLASS</div>
  ${rvStatsHTML(c, mut, shiny)}
  ${rvSkillHTML(c)}`;
}

function showRollResult(result, fromHistoryPreview) {
  if (result && !fromHistoryPreview) {
    pushRollHistory(result);
  }
  const overlay = document.getElementById('rollOverlay');
  if (!overlay) return;
  if (rollState.hideOverlay && !fromHistoryPreview) return;
  const reveal = document.getElementById('rollReveal');
  const showcase = document.getElementById('rollShowcase');
  const meta = document.getElementById('rollMeta');
  if (!reveal || !showcase || !meta) return;
  /* fix race: batalkan fade-out pending - timeout lama jangan nutup reveal baru */
  if (rollState.fadeTimer) { clearTimeout(rollState.fadeTimer); rollState.fadeTimer = null; }
  reveal.style.opacity = ''; reveal.style.transform = ''; reveal.style.transition = '';
  const cardData = getCardData(result.cardId);
  if (!cardData) return;
  rollState.currentCard = result;
  const mut = result.mut || 'none', shiny = !!result.shiny;
  const eff = effChance(result.cardId, mut, shiny);
  showcase.innerHTML = rvCardHTML(cardData, mut, shiny, eff);
  meta.innerHTML = rvMetaHTML(cardData, mut, shiny, eff);

  // Buka overlay. Animasi masuk HANYA sekali (saat pertama tampil) supaya tidak flicker muncul-hilang tiap tick.
  const wasVisible = overlay.style.display === 'flex';
  overlay.style.display = 'flex';
  reveal.classList.add('on');
  if (!wasVisible) {
    reveal.classList.remove('settled', 'slam'); void reveal.offsetWidth; reveal.classList.add('slam');
    rvSnd('whoosh', .5);
    setTimeout(() => rvSnd('slam', .6), 180);
    if (mut !== 'none' || shiny) setTimeout(() => rvSnd('sparkle', .45), 420);
  } else {
    reveal.classList.remove('slam'); reveal.classList.add('settled');
  }

  if (!fromHistoryPreview && eff >= RV_SHOWCASE_DEN && getComputedStyle(overlay).display !== 'none') {
    rvOpenShowcase(result, eff);
  }
}

/* ===== ANOMALY SHOWCASE — varian A BREACH (shutter tape + stamp, tanpa partikel) ===== */
function rvOpenShowcase(result, eff) {
  const sc = document.getElementById('rvShowcase');
  if (!sc) return;
  rollState.showcase = result;
  if (rollState.interval) { clearTimeout(rollState.interval); rollState.interval = null; }
  const c = getCardData(result.cardId);
  const mut = result.mut || 'none', shiny = !!result.shiny;
  const entry = String((state && state.totalRolls) || 0).padStart(4, '0');
  const full = Math.round(eff).toLocaleString('en-US');
  const alarm = `<div class="sc-alarm"><div class="tick">${('<span>ANOMALOUS SIGNAL</span><span>PROBABILITY BREACH</span><span>1 IN ' + full + '</span><span>REGISTERING VARIANT</span><span>HAZARD PROTOCOL 871</span>').repeat(3)}</div></div>`;
  const close = '<button class="sc-close" type="button" id="rvScClose" aria-label="Close showcase"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  const tags = `${shiny ? (typeof shinyStampHtml === 'function' ? shinyStampHtml(false, 'bchip') : '<span class="bchip" style="--c:#7DF9FF">SHINY</span>') : ''}
    ${mut !== 'none' ? (typeof mutStampHtml === 'function' ? mutStampHtml(mut, false, 'bchip') : `<span class="bchip" style="--c:${MUT_COLOR[mut]}">${mutText(mut, MUT_LABEL[mut])}</span>`) : ''}
    <span class="bchip" style="--c:rgba(245,245,245,.55)">${rvEsc(c.type).toUpperCase()}</span>`;
  sc.className = 'rv-showcase on sc-A';
  sc.innerHTML = alarm + close + `<div class="sc-body">
    <div class="sc-cardcol">
      <div class="sc-chance"><div class="big">1 IN <b>${fmtChance(eff)}</b></div><div class="full">1 IN ${full} // PROBABILITY BREACH CONFIRMED</div></div>
      ${rvCardHTML(c, mut, shiny, eff)}
    </div>
    <div class="sc-dossier">
      <div class="sc-entry">ARCHIVE ENTRY <b>#${entry}</b> // NEW VARIANT REGISTERED</div>
      <div class="sc-name">${mutText(mut, c.name)}</div>
      <div class="sc-tags">${tags}</div>
      ${rvStatsHTML(c, mut, shiny)}
      ${rvSkillHTML(c)}
      <div class="sc-paused">${rollState.active ? 'AUTO PAUSED — ANOMALY REVIEW' : ''}</div>
      <div class="sc-actions">
        <button class="rv-btn primary" type="button" id="rvScClaim">CLAIM CARD</button>
        <button class="rv-btn" type="button" id="rvScNext">CLAIM + ROLL</button>
      </div>
    </div>
    <div class="sc-stamp">BREACH</div>
    <div class="sc-shutter top"></div><div class="sc-shutter bot"></div>
  </div>`;
  document.getElementById('rvScClose').addEventListener('click', () => rvClaimShowcase(false));
  document.getElementById('rvScClaim').addEventListener('click', () => rvClaimShowcase(false));
  document.getElementById('rvScNext').addEventListener('click', () => rvClaimShowcase(true));
  document.addEventListener('keydown', rvEscHandler);
  requestAnimationFrame(() => requestAnimationFrame(() => sc.classList.add('open')));
  rvSnd('epic', .6);
}
function rvEscHandler(e) { if (e.key === 'Escape') rvClaimShowcase(false); }
function rvClaimShowcase(again) {
  const r = rollState.showcase;
  if (!r) return;
  rollState.showcase = null;
  document.removeEventListener('keydown', rvEscHandler);
  if (rollState.hideTimer) { clearTimeout(rollState.hideTimer); rollState.hideTimer = null; }
  const sc = document.getElementById('rvShowcase');
  if (sc) { sc.className = 'rv-showcase'; sc.innerHTML = ''; }
  rvSnd('claim', .55);
  if (rollState.active) { srScheduleNext(); return; }
  if (again) {
    hideRollResult();
    const rb = document.getElementById('rollBtn');
    if (rb) rb.click();
  } else {
    hideRollResult();
  }
}

// Modal profil: open/close + update data
/* ===== banner hazard masuk/keluar (#profileCurtain, pola #backpackCurtain) ===== */
let _prfT=[];
function prfHzClear(){for(const t of _prfT)clearTimeout(t);_prfT=[];}
function prfHzSetCopy(mode){
  const kick=document.getElementById("prfHzKick"),title=document.getElementById("prfHzTitle"),
        sub=document.getElementById("prfHzSub"),foot=document.getElementById("prfHzFoot"),
        serial=document.getElementById("prfHzSerial"),water=document.getElementById("prfHzWater");
  if(serial)serial.textContent=(0x1000+Math.floor(Math.random()*0xefff)).toString(16).toUpperCase();
  if(mode==="open"){
    if(kick)kick.innerHTML="// OPERATOR <b>UPLINK</b>";
    if(title)title.textContent="PROFILE";
    if(water)water.textContent="ID";
    if(sub)sub.textContent="OPERATOR DOSSIER · TELEMETRY · TEAM";
    if(foot)foot.textContent="SYNC DOSSIER";
  }else{
    if(kick)kick.innerHTML="// LINK <b>STAND BY</b>";
    if(title)title.textContent="HOLD";
    if(water)water.textContent="OUT";
    if(sub)sub.textContent="DOSSIER DISCONNECTING · DATA SAVED";
    if(foot)foot.textContent="CLOSE SESSION";
  }
}
function prfBannerOpen(){
  const c=document.getElementById("profileCurtain");if(!c)return;
  prfHzClear();prfHzSetCopy("open");
  c.className="";void c.offsetWidth;
  c.classList.add("on","smooth","sweep");
  _prfT.push(setTimeout(()=>c.classList.add("revealed"),1080));
  _prfT.push(setTimeout(()=>c.classList.remove("on","smooth","sweep","revealed"),1800));
}
function prfBannerClose(onCovered){
  const c=document.getElementById("profileCurtain");
  if(!c){if(onCovered)onCovered();return;}
  prfHzClear();prfHzSetCopy("close");
  c.className="";c.classList.add("on","smooth","revealed");void c.offsetWidth;
  c.classList.remove("revealed");
  _prfT.push(setTimeout(()=>{if(onCovered)onCovered();},560));
  _prfT.push(setTimeout(()=>c.classList.add("revealed"),780));
  _prfT.push(setTimeout(()=>c.classList.remove("on","smooth","revealed"),1560));
}

function openProfileModal(){
  const m=document.getElementById("profModal");
  if(!m)return;
  m.classList.add("show");
  document.body.classList.add("profile-open");
  renderProfile();
  switchProfTab("overview");
  try{ prfBannerOpen(); }catch(e){}
}
function closeProfileModal(){
  if(typeof hoverHide === "function") hoverHide();
  if(typeof closeCardInspector === "function") closeCardInspector();
  const m=document.getElementById("profModal");
  if(!m){document.body.classList.remove("profile-open");return;}
  const hide=()=>{m.classList.remove("show");document.body.classList.remove("profile-open");};
  try{ prfBannerClose(hide); }catch(e){ hide(); }
}

function switchProfTab(tab){
  const btnOv = document.getElementById('tabOverviewBtn');
  const btnEx = document.getElementById('tabExtraBtn');
  const bodyOv = document.getElementById('profOverviewBody');
  const bodyEx = document.getElementById('profExtraBody');

  if (tab === 'overview') {
    if (btnOv) btnOv.className = 'prf-tab-btn active';
    if (btnEx) btnEx.className = 'prf-tab-btn inactive';
    if (bodyOv) bodyOv.style.display = 'grid';
    if (bodyEx) bodyEx.classList.remove('active');
  } else {
    if (btnOv) btnOv.className = 'prf-tab-btn inactive';
    if (btnEx) btnEx.className = 'prf-tab-btn active';
    if (bodyOv) bodyOv.style.display = 'none';
    if (bodyEx) bodyEx.classList.add('active');
  }
}
window.switchProfTab = switchProfTab;
window.profTabGo = switchProfTab;

let isTeamHidden = false;
function toggleTeamDisplay(){
  isTeamHidden = !isTeamHidden;
  const content = document.getElementById('profTeamContent');
  const btn = document.getElementById('hideTeamBtn');
  if (isTeamHidden) {
    if (content) content.classList.add('collapsed');
    if (btn) btn.textContent = '[ SHOW TEAM ]';
  } else {
    if (content) content.classList.remove('collapsed');
    if (btn) btn.textContent = '[ HIDE TEAM ]';
  }
}
window.toggleTeamDisplay = toggleTeamDisplay;

function onSearchUser(q){
  if(!q || !q.trim()) return;
  const target = q.trim();
  if (typeof window.openRkProfile === "function") {
    window.openRkProfile(target);
  } else if (typeof showToast === "function") {
    showToast("SEARCHING OPERATOR: " + target.toUpperCase());
  }
}
window.onSearchUser = onSearchUser;

function inspectCard(stackOrChar, name, atk, hp, tier, customSkill) {
  const dlg = document.getElementById('cardInspectorDialog');
  if (!dlg) return;

  let s = null;
  let charId = stackOrChar;

  if (typeof stackOrChar === 'object' && stackOrChar) {
    s = stackOrChar;
    charId = s.char;
  } else if (typeof stackOrChar === 'string') {
    s = (state && state.stacks) ? state.stacks.find(x => x.id === stackOrChar) : null;
    if (!s) {
      s = (state && state.stacks) ? state.stacks.find(x => x.char === stackOrChar) : null;
      if (!s && typeof CARDS !== 'undefined' && CARDS[stackOrChar]) charId = stackOrChar;
    } else {
      charId = s.char;
    }
  }

  const c = (typeof CARDS !== 'undefined' && charId) ? CARDS[charId] : null;
  const realName = c ? (typeof cardName === 'function' ? cardName(charId) : c.name) : (name || 'CARD');
  const realTier = c ? (c.chance ? ('1 IN ' + fmtChance(c.chance)) : (c.tier || 'STANDARD').toUpperCase()) : (tier || 'STANDARD');
  const realImg = c ? (typeof cardImg === 'function' ? cardImg(charId) : ('assets/cards/art/' + charId + '.webp')) : '';
  const stats = (c && s && typeof cardStats === 'function') 
    ? cardStats(s.char, s.mut, s.trait, s.shiny) 
    : (c && typeof cardStats === 'function' ? cardStats(charId, 'none', 'none', false) : { atk: atk || 0, hp: hp || 0 });
  const realPName = (typeof passiveName === 'function' ? passiveName(charId) : (c && c.passive ? c.passive.name : '')) || 'Passive Skill';
  const realDesc = (typeof skillText === 'function' ? skillText(charId) : (c && c.passive ? c.passive.desc : '')) || (customSkill || 'Standard combat unit.');
  const fullSkill = '[' + realPName + '] ' + realDesc;

  const imgEl = document.getElementById('inspectImg');
  if (imgEl && realImg) imgEl.src = realImg;
  const nameEl = document.getElementById('inspectName');
  if (nameEl) nameEl.textContent = realName;
  const atkEl = document.getElementById('inspectAtk');
  if (atkEl) atkEl.textContent = typeof fmtStat === 'function' ? fmtStat(stats.atk) : (stats.atk || '—');
  const hpEl = document.getElementById('inspectHp');
  if (hpEl) hpEl.textContent = typeof fmtStat === 'function' ? fmtStat(stats.hp) : (stats.hp || '—');
  const tierEl = document.getElementById('inspectTier');
  if (tierEl) tierEl.textContent = realTier;
  const statusEl = document.getElementById('inspectStatus');
  if (statusEl) statusEl.textContent = s ? (s.shiny ? 'SHINY' : (s.mut && s.mut !== 'none' ? s.mut.toUpperCase() : 'EQUIPPED')) : 'EQUIPPED';
  const skillEl = document.getElementById('inspectSkill');
  if (skillEl) skillEl.textContent = fullSkill;

  dlg.classList.add('show');
}
window.inspectCard = inspectCard;

function inspectRebirth() {
  const dlg = document.getElementById('cardInspectorDialog');
  if (!dlg) return;
  const rb = typeof rebirthCount === 'function' ? rebirthCount() : 0;
  const mult = typeof rebirthLuckMult === 'function' ? rebirthLuckMult(rb) : (rb <= 0 ? 1 : rb * 5);
  const cost = typeof rebirthThreshold === 'function' ? rebirthThreshold() : 0;
  const ess = typeof rebirthEssence === 'function' ? rebirthEssence() : 0;

  const imgEl = document.getElementById('inspectImg');
  if (imgEl) imgEl.src = 'assets/icons/drawer/rebirth.webp';
  const nameEl = document.getElementById('inspectName');
  if (nameEl) nameEl.textContent = 'ASCENSION // REBIRTH R' + rb;
  const atkEl = document.getElementById('inspectAtk');
  if (atkEl) atkEl.textContent = '×' + mult + ' LUCK';
  const hpEl = document.getElementById('inspectHp');
  if (hpEl) hpEl.textContent = typeof fmt === 'function' ? (fmt(ess) + ' / ' + fmt(cost)) : (ess + ' / ' + cost);
  const tierEl = document.getElementById('inspectTier');
  if (tierEl) tierEl.textContent = 'REBIRTH';
  const statusEl = document.getElementById('inspectStatus');
  if (statusEl) statusEl.textContent = 'ACTIVE';
  const skillEl = document.getElementById('inspectSkill');
  if (skillEl) skillEl.textContent = 'Permanent Ascension: Rebirth Cycle R' + rb + ' permanently amplifies Total Luck by ×' + mult + ' across all rolls. Current Essence: ' + (typeof fmt === 'function' ? fmt(ess) : ess) + ' / ' + (typeof fmt === 'function' ? fmt(cost) : cost) + ' needed for next cycle.';

  dlg.classList.add('show');
}
window.inspectRebirth = inspectRebirth;

function inspectSupport(type, id) {
  const dlg = document.getElementById('cardInspectorDialog');
  if (!dlg) return;

  let img = '';
  let name = '';
  let atk = '—';
  let hp = '—';
  let tier = 'SUPPORT';
  let status = 'EQUIPPED';
  let skill = '';

  if (type === 'art') {
    const d = typeof ART_DEFS !== 'undefined' ? ART_DEFS.find(x => x.id === id) : null;
    if (d) {
      name = d.name;
      img = d.img || ('assets/artifacts/' + d.id + '.webp');
      if (!img.startsWith('assets/')) img = 'assets/artifacts/' + img;
      atk = '+' + (d.flat || 0) + ' PWR';
      hp = d.pct ? ('+' + d.pct + '% LUCK') : '—';
      tier = 'ARTIFACT';
      skill = 'Passive Resonance: Grants +' + (d.flat || 0) + ' flat battle power and +' + (d.pct || 0) + '% total luck scaling across combat and roll actions.';
    }
  } else if (type === 'pet') {
    const pd = typeof PET_DEFS !== 'undefined' ? PET_DEFS.find(x => x.id === id) : null;
    if (pd) {
      name = pd.name;
      img = pd.img || ('assets/pets/' + pd.id + '.webp');
      if (!img.startsWith('assets/')) img = 'assets/pets/' + img;
      atk = '+' + (pd.flat || 0) + ' PWR';
      hp = pd.pct ? ('+' + pd.pct + '% LUCK') : '—';
      tier = 'PET COMPANION';
      skill = 'Companion Aura: Accompanies operator in battle, granting +' + (pd.flat || 0) + ' flat battle power and +' + (pd.pct || 0) + '% luck multiplier.';
    }
  }

  if (!name) return;

  const imgEl = document.getElementById('inspectImg');
  if (imgEl) imgEl.src = img;
  const nameEl = document.getElementById('inspectName');
  if (nameEl) nameEl.textContent = name;
  const atkEl = document.getElementById('inspectAtk');
  if (atkEl) atkEl.textContent = atk;
  const hpEl = document.getElementById('inspectHp');
  if (hpEl) hpEl.textContent = hp;
  const tierEl = document.getElementById('inspectTier');
  if (tierEl) tierEl.textContent = tier;
  const statusEl = document.getElementById('inspectStatus');
  if (statusEl) statusEl.textContent = status;
  const skillEl = document.getElementById('inspectSkill');
  if (skillEl) skillEl.textContent = skill;

  dlg.classList.add('show');
}
window.inspectSupport = inspectSupport;

function closeCardInspector() {
  const dlg = document.getElementById('cardInspectorDialog');
  if (dlg) dlg.classList.remove('show');
}
window.closeCardInspector = closeCardInspector;

function pfOpenDeck() {
  if (typeof closeProfileModal === 'function') closeProfileModal();
  if (typeof openDeckModal === 'function') {
    openDeckModal();
  } else if (typeof openDeckPick === 'function') {
    openDeckPick();
  } else if (typeof toggleBackpack === 'function') {
    if (typeof bpSetTab === 'function') bpSetTab('koleksi');
    toggleBackpack();
  }
}
window.pfOpenDeck = pfOpenDeck;

function pfOpenBackpack(tab) {
  if (typeof closeProfileModal === 'function') closeProfileModal();
  if (typeof toggleBackpack === 'function') {
    if (tab && typeof bpSetTab === 'function') bpSetTab(tab);
    toggleBackpack();
  }
}
window.pfOpenBackpack = pfOpenBackpack;

let _profModalWasOpen = false;

function pfOpenTitles() {
  _profModalWasOpen = true;
  const pm = document.getElementById("profModal");
  if (pm) {
    pm.classList.remove("show");
    document.body.classList.remove("profile-open");
  }
  openTitlesModal();
}
window.pfOpenTitles = pfOpenTitles;

// Titles screen — hazard WoB (full-bleed, pola #rankModal)
function openTitlesModal(){
  const m=document.getElementById("titlesModal");
  if(!m)return;
  const pm=document.getElementById("profModal");
  if(pm && pm.classList.contains("show")){
    _profModalWasOpen = true;
    pm.classList.remove("show");
    document.body.classList.remove("profile-open");
  }
  const closeBtn=document.getElementById("titlesClose");
  if(closeBtn)closeBtn.onclick=closeTitlesModal;
  if(m.classList.contains("show")){renderTitlesModal();return;}
  renderTitlesModal();
  m.classList.add("show");
  document.body.classList.add("titles-open");
  if(typeof ttBannerOpen==="function")ttBannerOpen();
}
function closeTitlesModal(){
  const m=document.getElementById("titlesModal");
  if(!m)return;
  m.classList.remove("show");
  document.body.classList.remove("titles-open");
  if(typeof ttBannerClose==="function"){
    try{ ttBannerClose(); }catch(e){}
  }
  if (_profModalWasOpen) {
    _profModalWasOpen = false;
    setTimeout(() => {
      if (typeof openProfileModal === 'function') openProfileModal();
    }, 320);
  }
}
window.closeTitlesModal = closeTitlesModal;
window.openTitlesModal = openTitlesModal;
let _currentPreviewTitleId = null;

function previewTitle(titleId) {
  const defs = (typeof window.getTitlesList === 'function') ? window.getTitlesList() : (window.TITLE_DEFS || []);
  const found = defs.find(x => x.id === titleId || x.name === titleId);
  if (!found) return;
  _currentPreviewTitleId = titleId;

  const mount = document.getElementById("tmPreviewTitleMount");
  if (mount && typeof renderSoloGodAuraHtml === 'function') {
    mount.innerHTML = renderSoloGodAuraHtml(found, { bob: true });
  }

  // Highlight previewed card in list
  document.querySelectorAll("#titlesListGrid .tm-card").forEach(c => {
    c.classList.remove("previewing");
    if (c.getAttribute("data-title-id") === titleId) c.classList.add("previewing");
  });
}
window.previewTitle = previewTitle;

function equipTitle(titleKey){
  state.playerTitle = titleKey;
  _currentPreviewTitleId = titleKey;
  save();
  renderTitlesModal();
  renderProfile();
  if(location.hash==="#/lobby"&&typeof render==="function")render();
  const _def=(typeof TITLE_DEFS!=="undefined"?TITLE_DEFS:(window.TITLE_DEFS||[])).find(t=>t.id===titleKey);
  const _name=_def?_def.name:titleKey;
  const _col=(_def&&_def.colors)?_def.colors[0]:"#f3e600";
  toast("TITLE EQUIPPED", `[${_name}] ACTIVE AS CARD CROWN`, _col);
}

function renderTitlesModal(){
  if(!state)return;
  const p=state.player||{};
  const lv=p.lv||state.playerLv||1;
  const curT=state.playerTitle || "ROOKIE";

  const TITLE_DEFS = (typeof window.getTitlesList === "function") ? window.getTitlesList() : (window.TITLE_DEFS || []);
  window.TITLE_DEFS = TITLE_DEFS;

  // Selected or Equipped Def for preview
  if (!_currentPreviewTitleId) _currentPreviewTitleId = curT;
  const previewDef = TITLE_DEFS.find(x=>x.id===_currentPreviewTitleId || x.name===_currentPreviewTitleId) || TITLE_DEFS.find(x=>x.id===curT) || TITLE_DEFS[0];
  const activeDef=TITLE_DEFS.find(x=>x.id===curT || x.name===curT)||TITLE_DEFS.find(x=>x.id==="ROOKIE")||TITLE_DEFS[0];
  const unlockedCount=TITLE_DEFS.filter(t=>t.unlocked).length;
  const tsU=document.getElementById("ttTsUnlocked");
  if(tsU)tsU.textContent=unlockedCount+"/"+TITLE_DEFS.length;
  const tsE=document.getElementById("ttTsEquipped");
  if(tsE)tsE.textContent=activeDef.name;
  const lc=document.getElementById("ttListCount");
  if(lc)lc.textContent=TITLE_DEFS.length+" TITLES";

  // Update Preview Box with 1:1 Studio Card Standee
  const pBox=document.getElementById("tmPreviewBox");
  if(pBox){
    const eq = (typeof equipped === 'function') ? equipped() : null;
    const charKey = (eq && eq.char) ? eq.char : 'nine-tail-prodigy';
    const cData = (typeof CARDS !== 'undefined' && CARDS[charKey]) ? CARDS[charKey] : { name: 'Nine-Tail Prodigy', atk: 95000, hp: 320000 };
    const cArt = (typeof cardArt === 'function') ? cardArt(charKey) : ('assets/cards/art/' + charKey + '.webp');
    const cName = (typeof cardName === 'function') ? cardName(charKey) : (cData.name || 'Nine-Tail Prodigy');
    const cStats = 'ATK ' + (typeof fmtStat === 'function' ? fmtStat(cData.atk || 95000) : (cData.atk || '95k')) + ' · HP ' + (typeof fmtStat === 'function' ? fmtStat(cData.hp || 320000) : (cData.hp || '320k')) + ' · TACTICAL STRIKER';

    const auraHtml = (typeof renderSoloGodAuraHtml === 'function')
      ? renderSoloGodAuraHtml(previewDef, { bob: true })
      : renderTitleCrownHtml(previewDef.id, previewDef.cls);

    pBox.innerHTML = `
      <div class="tt-solo-preview-mount" id="tmPreviewTitleMount">
        ${auraHtml}
      </div>
    `;
  }

  // Update List Grid
  const listGrid=document.getElementById("titlesListGrid");
  if(listGrid){
    listGrid.innerHTML=TITLE_DEFS.map(t=>{
      const isEq=(t.id===curT || t.name===curT);
      const isPrev=(t.id===previewDef.id);
      const cardCls=(isEq ? "equipped" : t.unlocked ? "unlocked" : "locked") + (isPrev ? " previewing" : "");
      const iconSvg=(typeof TITLE_ICONS!=='undefined' && TITLE_ICONS[t.iconKey]) ? TITLE_ICONS[t.iconKey] : '';
      let btnHtml="";
      if(isEq){
        btnHtml=`<button class="tm-action-btn btn-active" disabled>EQUIPPED</button>`;
      }else if(t.unlocked){
        btnHtml=`<button class="tm-action-btn btn-equip" onclick="event.stopPropagation(); equipTitle('${t.id}')">EQUIP</button>`;
      }else{
        btnHtml=`<button class="tm-action-btn btn-locked" disabled>LOCKED</button>`;
      }
      return `<div class="tm-card ${cardCls}" data-title-id="${t.id}" onclick="previewTitle('${t.id}')" style="--aura-col:${t.colors[0]};--aura-glow:${t.colors[0]}50;">
        <div class="tm-icon-box">
          ${iconSvg}
        </div>
        <div class="tm-info">
          <div class="tm-c-name">${t.name}</div>
          <div class="tm-c-desc">${t.desc}</div>
          <div class="tm-c-req">REQUIREMENT: ${t.req}</div>
        </div>
        ${btnHtml}
      </div>`;
    }).join("");
  }
}

function ttBannerOpen(){
  const c=document.getElementById("titlesCurtain");
  if(!c)return;
  ttSeq++;
  ttHzClear(); ttHzSetCopy("open");
  c.className=""; void c.offsetWidth;
  c.classList.add("on","smooth","sweep");
  ttHzTimers.push(setTimeout(()=>c.classList.add("revealed"),1080));
  ttHzTimers.push(setTimeout(()=>c.classList.remove("on","smooth","sweep","revealed"),1800));
}
/* EXIT 3 fase: tirai MENUTUP -> konten disembunyikan -> tirai MEMBUKA.
   Fase 3 wajib; tanpanya layar tertahan tertutup ("banner tidak kebuka"). */
function ttBannerClose(onCovered){
  const c=document.getElementById("titlesCurtain");
  if(!c){ if(onCovered)onCovered(); return; }
  const seq=++ttSeq;
  ttHzClear(); ttHzSetCopy("close");
  c.className=""; c.classList.add("on","smooth","revealed"); void c.offsetWidth;
  c.classList.remove("revealed");
  ttHzTimers.push(setTimeout(()=>{ if(seq===ttSeq&&onCovered)onCovered(); },560));
  ttHzTimers.push(setTimeout(()=>{ if(seq!==ttSeq)return; c.classList.add("revealed"); },780));
  ttHzTimers.push(setTimeout(()=>{ if(seq!==ttSeq)return; c.classList.remove("on","smooth","revealed"); },1560));
}

/* ============ PROFILE SCREEN (hazard WoB) — render ============ */
function pfPlayTime(){
  const playSec=Math.floor((state&&state.playSec)||0);
  const h=Math.floor(playSec/3600), m=Math.floor((playSec%3600)/60), s=playSec%60;
  if(h>0)return h + 'h ' + m + 'm';
  if(m>0)return m + 'm ' + s + 's';
  return s + 's';
}

function pfStatRows(){
  const _Kc=rollCommonScale();
  let rarest=null, rarestCh=-Infinity;
  for(const s of (state.stacks||[])){
    const c=CARDS[s.char]; if(!c)continue;
    const den=(c.chance||chanceOf(c.tier))*(s.shiny?SHINY_CHANCE_MULT:1)*(MUT_CHANCE_MULT[s.mut||"none"]||1);
    const ch=den>=ROLL_RARE_DEN?den:den/_Kc;
    if(ch>rarestCh){rarestCh=ch;rarest=s;}
  }
  const spm=playerSpeedMult(), swm=weatherSpeedMult();
  const eff=Math.min(spm*swm,RNG_ROLL_MAX_MULT);
  const artTotal=typeof ART_DEFS!=="undefined"?ART_DEFS.length:0;
  const petTotal=typeof PET_DEFS!=="undefined"?PET_DEFS.length:0;
  const supOwned=((state.artOwned||[]).length+(state.petOwned||[]).length);
  const rb = typeof rebirthCount === "function" ? rebirthCount() : 0;
  const mult = typeof rebirthLuckMult === "function" ? rebirthLuckMult(rb) : (rb <= 0 ? 1 : rb * 5);

  const rows=[
    ["rolls","Rolls",fmt(state.totalRolls||0),""],
    ["luck","Luck",totalLuck().toFixed(1)+"×","hz"],
    ["speed","Roll speed",eff.toFixed(1)+"×",""],
    ["shiny","Shiny chance","1 in "+fmtChance(100*(typeof shinyChanceMult==="function"?shinyChanceMult():SHINY_CHANCE_MULT)),""],
    ["rarest","Rarest card",rarest?cardName(rarest.char):"—","cyan"],
    ["floor","Highest floor",String((state.tower&&state.tower.best)||0),"gold"],
    ["playtime","Playtime",pfPlayTime(),""],
    ["power","Total power",fmt(totalPower()),""],
    ["supports","Supports found",(supOwned+"/"+(artTotal+petTotal)),""],
    ["rebirth","Rebirth","Cycle R" + rb + (mult > 1 ? (" (×" + mult + " Luck)") : ""),"hz"]
  ];
  return {rows,rarest,rarestCh};
}

function updateProfileLiveNumbers(){
  if(!state)return;
  const m=document.getElementById("profModal");
  if(!m||!m.classList.contains("show"))return;
  const p=state.player||{};
  const lv=p.lv||state.playerLv||1;
  const xpNeed=lv*1000, curExp=p.exp||0;
  const xpPct=Math.max(0,Math.min(100,Math.round(curExp/xpNeed*100)));
  const setText=(id,val)=>{const el=document.getElementById(id);if(el&&el.textContent!==String(val))el.textContent=val;};

  setText("profLevelBadge", "LV." + lv);
  setText("profExpBadge", fmt(curExp) + ' / ' + fmt(xpNeed) + ' EXP (' + xpPct + '%)');
  const xf=document.getElementById("profExpFill");
  if(xf&&xf.style.width!==(xpPct+"%"))xf.style.width=xpPct+"%";

  const stats=pfStatRows();
  for(const r of stats.rows){
    const el=document.getElementById("st" + r[0].charAt(0).toUpperCase() + r[0].slice(1));
    if(el&&el.textContent!==String(r[2]))el.textContent=r[2];
  }
}
window.updateProfileLiveNumbers=updateProfileLiveNumbers;

function renderProfile(){
  if(!state)return;
  const p=state.player||{};
  const lv=p.lv||state.playerLv||1;
  const xpNeed=lv*1000, curExp=p.exp||0;
  const xpPct=Math.max(0,Math.min(100,Math.round(curExp/xpNeed*100)));
  const eq=equipped();

  const name=currentUser||"GUEST";
  const nm=document.getElementById("profPlayerName");if(nm)nm.textContent=name;
  const hd=document.getElementById("profPlayerHandle");if(hd)hd.textContent="@"+name;
  
  // Avatar
  const avImg=document.getElementById("profAvatarImg");
  const avSrc=(state.customAvatar)||(eq&&eq.char&&CARDS[eq.char]?cardImg(eq.char):"assets/cards/art/nine-tail-prodigy.webp");
  if(avImg&&avImg.src!==avSrc) avImg.src = avSrc;

  // Hero Standee + Mutation/Shiny Hazard Border
  const standeeImg=document.getElementById("profStandeeArt");
  const standeeSrc=eq&&eq.char&&CARDS[eq.char]?cardImg(eq.char):"assets/cards/art/nine-tail-prodigy.webp";
  if(standeeImg&&standeeImg.src!==standeeSrc) standeeImg.src = standeeSrc;
  const standeeBox=document.querySelector("#profModal .prf-standee-box");
  if(standeeBox){
    const eqMut=(eq&&eq.mut&&eq.mut!=="none")?eq.mut:"none";
    const eqShiny=!!(eq&&eq.shiny);
    const hzCls=(typeof hzBorderCls==="function")?hzBorderCls(eqMut,eqShiny):"";
    standeeBox.className="prf-standee-box"+(eqShiny?" shiny":"")+(eqMut!=="none"?" mut-"+eqMut:"")+hzCls;
    if(typeof hzBorderLayerHtml==="function" && !standeeBox.querySelector(".xbdr-ring")){
      standeeBox.insertAdjacentHTML("afterbegin", hzBorderLayerHtml());
    }
  }

  // Standee Hero Card Meta
  const heroCard = (eq && eq.char && CARDS[eq.char]) ? CARDS[eq.char] : null;
  const heroNameEl = document.getElementById("profHeroName");
  const heroStatsEl = document.getElementById("profHeroStats");

  if (heroCard && eq) {
    const heroStats = cardStats(eq.char, eq.mut, eq.trait, eq.shiny);
    if (heroNameEl) heroNameEl.textContent = cardName(eq.char);
    if (heroStatsEl) heroStatsEl.textContent = '⚔ ' + fmtStat(heroStats.atk) + ' · ❤ ' + fmtStat(heroStats.hp);
  }

  // Title
  const curT=state.playerTitle||"ROOKIE";
  const defs = (typeof window.getTitlesList === "function") ? window.getTitlesList() : ((typeof TITLE_DEFS !== "undefined") ? TITLE_DEFS : (window.TITLE_DEFS || []));
  const def=defs.find(x=>x.id===curT||x.name===curT)||defs[0]||{name:curT,colors:["#00f0ff","#ffffff"]};
  const titleLbl=document.getElementById("profTitleLabel");
  if(titleLbl) titleLbl.textContent = def.name;
  const titleTrigger=document.getElementById("profEquippedTitle");
  if(titleTrigger && def.colors){
    const col=def.colors[0]||"#00f0ff";
    titleTrigger.style.color = col;
    titleTrigger.style.textShadow = '0 0 10px ' + col + ', 0 0 20px ' + col + '60';
  }

  // Floating Solo God Aura Crown
  const crownMount=document.getElementById("profStandeeCrown");
  if(crownMount && def && typeof renderSoloGodAuraHtml === "function"){
    crownMount.innerHTML = renderSoloGodAuraHtml(def, { bob: true });
  }

  // Level & Exp
  const lvBadge=document.getElementById("profLevelBadge");if(lvBadge)lvBadge.textContent="LV."+lv;
  const expBadge=document.getElementById("profExpBadge");if(expBadge)expBadge.textContent=fmt(curExp) + ' / ' + fmt(xpNeed) + ' EXP (' + xpPct + '%)';
  const expFill=document.getElementById("profExpFill");if(expFill)expFill.style.width=xpPct+"%";

  // Stats calculation
  const stats=pfStatRows();
  const rb = typeof rebirthCount === "function" ? rebirthCount() : 0;
  const mult = typeof rebirthLuckMult === "function" ? rebirthLuckMult(rb) : (rb <= 0 ? 1 : rb * 5);

  // 1. Telemetry Stats Grid (10 Real Game Stats)
  const statsGrid=document.getElementById("profStatsGrid");
  if(statsGrid){
    statsGrid.innerHTML = stats.rows.map(r => 
      '<div class="prf-stat-row">' +
        '<span class="prf-stat-k">' + r[1] + '</span>' +
        '<span class="prf-stat-v' + (r[3] ? ' ' + r[3] : '') + '" id="st' + (r[0].charAt(0).toUpperCase() + r[0].slice(1)) + '">' + r[2] + '</span>' +
      '</div>'
    ).join('');
  }

  // 2. Telemetry Showcase (Real Rarest + Real Rebirth)
  const scRow=document.getElementById("profShowcaseRow");
  if(scRow){
    const rarestStack = stats.rarest;

    // Slot 1: Rarest Card (with small "RAREST CARD" label below)
    let slot2Html = '';
    if (rarestStack && CARDS[rarestStack.char]) {
      const rarestName = cardName(rarestStack.char);
      const rarestImg = cardImg(rarestStack.char);
      const rarestDenom = stats.rarestCh > 0 ? fmtChance(stats.rarestCh) : '1';
      const rarHzCls = (typeof hzBorderCls === 'function') ? hzBorderCls(rarestStack.mut || 'none', !!rarestStack.shiny, { tile: true, dense: true }) : '';
      const rarHzLayers = (typeof hzBorderLayerHtml === 'function') ? hzBorderLayerHtml() : '';
      slot2Html = 
        '<div class="prf-showcase-col">' +
          '<div class="prf-showcase-slot rarest-slot' + rarHzCls + '" onclick="inspectCard(\'' + rarestStack.id + '\')" title="Rarest Card: ' + rarestName + ' (1 IN ' + rarestDenom + ')">' +
            rarHzLayers +
            '<div class="sc-holo-sweep"></div>' +
            '<div class="sc-art-shell">' +
              '<img src="' + rarestImg + '" alt="' + rarestName + '">' +
              '<div class="sc-vignette"></div>' +
            '</div>' +
            '<span class="sc-crn tl"></span><span class="sc-crn br"></span>' +
          '</div>' +
          '<div class="sc-below-lbl">RAREST CARD</div>' +
        '</div>';
    } else {
      slot2Html = 
        '<div class="prf-showcase-col">' +
          '<div class="prf-showcase-slot rarest-slot empty" title="No Rare Card Yet">' +
            '<div class="sc-art-shell empty-art">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="sc-empty-icon">' +
                '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' +
              '</svg>' +
            '</div>' +
            '<span class="sc-crn tl"></span><span class="sc-crn br"></span>' +
          '</div>' +
          '<div class="sc-below-lbl">RAREST CARD</div>' +
        '</div>';
    }

    // Slot 2: Rebirth
    const slot3Html = 
      '<div class="prf-showcase-col">' +
        '<div class="prf-showcase-slot rebirth-slot" onclick="inspectRebirth()" title="Cycle R' + rb + ' (×' + mult + ' Permanent Luck Multiplier)">' +
          '<div class="sc-holo-sweep"></div>' +
          '<div class="sc-art-shell rebirth-art">' +
            '<svg class="sc-rebirth-mandala" viewBox="0 0 100 100">' +
              '<circle cx="50" cy="50" r="42" fill="none" stroke-width="1.2" stroke-dasharray="6 4"/>' +
              '<circle cx="50" cy="50" r="30" fill="none" stroke-width="1.4" stroke-dasharray="12 6"/>' +
              '<polygon points="50,12 84,70 16,70" fill="none" stroke-width="1.2"/>' +
              '<polygon points="50,88 84,30 16,30" fill="none" stroke-width="1.2"/>' +
              '<circle cx="50" cy="50" r="14" fill="none" stroke-width="1.8"/>' +
            '</svg>' +
            '<div class="sc-rebirth-pedestal"></div>' +
            '<img src="assets/icons/drawer/rebirth.webp" alt="Rebirth Icon" class="sc-rebirth-icon">' +
            '<div class="sc-vignette"></div>' +
          '</div>' +
          '<span class="sc-crn tl"></span><span class="sc-crn br"></span>' +
        '</div>' +
        '<div class="sc-below-lbl lbl-rebirth">REBIRTH</div>' +
      '</div>';

    scRow.innerHTML = slot2Html + slot3Html;
  }

  // 3. Team Row 1: Cards (4 slots from state.deck with New Solid Stamps & Top Title)
  const teamCardsEl = document.getElementById("profTeamCards");
  if(teamCardsEl){
    const deckIds = state.deck || [];
    const cardsHtml = [0, 1, 2, 3].map(i => {
      const slotId = deckIds[i];
      const s = slotId ? (state.stacks || []).find(x => x.id === slotId) : null;
      const c = s ? CARDS[s.char] : null;

      if (!s || !c) {
        return (
          '<div class="prf-card-chassis empty-chassis" onclick="pfOpenDeck()" title="Slot ' + (i + 1) + ' Empty - Click to Manage Deck">' +
            '<div class="empty-art">' +
              '<span class="pcc-slot-no">0' + (i + 1) + '</span>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="pcc-empty-icon">' +
                '<path d="M12 5v14M5 12h14"/>' +
              '</svg>' +
            '</div>' +
          '</div>'
        );
      }

      const stats = cardStats(s.char, s.mut, s.trait, s.shiny);
      const cardTitle = cardName(s.char);
      const imgPath = cardImg(s.char);
      const tier = c.tier || '';
      const chanceVal = luckChance(s.char, s.mut, s.shiny);
      const chanceStr = (typeof rarityText === 'function' ? rarityText(tier, chanceVal) : '') || (c.chance ? ('1 IN ' + fmtChance(c.chance)) : '1 IN 100');

      // Authentic New Game Stamps (Shiny / Mut / Trait)
      const shBadge = s.shiny && typeof shinyStampHtml === 'function' ? shinyStampHtml(true) : '';
      const mBadge = s.mut && s.mut !== 'none'
        ? (typeof mutChip === 'function' && typeof mutStampHtml === 'function' ? mutChip(s.mut, mutStampHtml(s.mut, true)) : (typeof mutStampHtml === 'function' ? mutStampHtml(s.mut, true) : ''))
        : '';
      const tBadge = s.trait && s.trait !== 'none'
        ? (typeof traitChip === 'function' && typeof traitStampHtml === 'function' ? traitChip(s.trait, traitStampHtml(s.trait, true)) : (typeof traitStampHtml === 'function' ? traitStampHtml(s.trait, true) : ''))
        : '';
      const stampsHtml = (shBadge || mBadge || tBadge) ? ('<div class="pcc-stamps">' + shBadge + mBadge + tBadge + '</div>') : '';

      const hzCls = (typeof hzBorderCls === 'function') ? hzBorderCls(s.mut || 'none', !!s.shiny, { tile: true, dense: true }) : '';
      const hzLayers = (typeof hzBorderLayerHtml === 'function') ? hzBorderLayerHtml() : '';

      return (
        '<div class="prf-card-chassis' + (s.shiny ? ' shiny' : '') + (s.mut && s.mut !== 'none' ? ' mut-' + s.mut : '') + (hzCls ? ' ' + hzCls : '') + '" onclick="inspectCard(\'' + s.id + '\')" title="' + cardTitle + ' | ⚔ ' + fmtStat(stats.atk) + ' · ❤ ' + fmtStat(stats.hp) + '">' +
          hzLayers +
          '<div class="pcc-top-bar">' +
            '<div class="pcc-top-left">' +
              '<span class="pcc-slot-no">0' + (i + 1) + '</span>' +
              '<span class="pcc-name">' + cardTitle + '</span>' +
            '</div>' +
            stampsHtml +
          '</div>' +
          '<div class="pcc-art-shell">' +
            '<img src="' + imgPath + '" alt="' + cardTitle + '"' + (c.pos ? ' style="object-position:' + c.pos + '"' : '') + '>' +
            '<div class="pcc-vignette"></div>' +
          '</div>' +
          '<div class="pcc-plate">' +
            '<div class="pcc-chance">' + chanceStr + '</div>' +
            '<div class="pcc-stats-box">' +
              '<div class="pcc-stat-box-item hp"><i>HP</i> <b>' + fmtStat(stats.hp) + '</b></div>' +
              '<div class="pcc-stat-box-item atk"><i>ATK</i> <b>' + fmtStat(stats.atk) + '</b></div>' +
            '</div>' +
          '</div>' +
          '<span class="pcc-crn tl"></span><span class="pcc-crn br"></span>' +
        '</div>'
      );
    }).join('');

    teamCardsEl.innerHTML = cardsHtml;
  }

  // 4. Team Row 2: Supports (Artifacts 1 & 2, and Pet — 3 equal slots)
  const teamSuppEl = document.getElementById("profTeamSupp");
  if(teamSuppEl){
    const art0 = state.artSlots && state.artSlots[0];
    const art1 = state.artSlots && state.artSlots[1];
    const petId = state.petEquipped;

    const d0 = art0 && typeof ART_DEFS !== 'undefined' ? ART_DEFS.find(x => x.id === art0) : null;
    const d1 = art1 && typeof ART_DEFS !== 'undefined' ? ART_DEFS.find(x => x.id === art1) : null;
    const pd = petId && typeof PET_DEFS !== 'undefined' ? PET_DEFS.find(x => x.id === petId) : null;

    const suppSlots = [
      { type: 'art', data: d0, label: 'ART 1', openTab: 'artefact' },
      { type: 'art', data: d1, label: 'ART 2', openTab: 'artefact' },
      { type: 'pet', data: pd, label: 'PET', openTab: 'pet' }
    ];

    const suppHtml = suppSlots.map((slot, idx) => {
      const item = slot.data;
      if (!item) {
        return (
          '<div class="prf-card-chassis support-chassis empty-chassis" onclick="pfOpenBackpack(\'' + slot.openTab + '\')" title="' + slot.label + ' Empty - Click to Manage Backpack">' +
            '<div class="empty-art">' +
              '<span class="pcc-support-tag">' + slot.label + '</span>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="pcc-empty-icon">' +
                '<path d="M12 5v14M5 12h14"/>' +
              '</svg>' +
            '</div>' +
          '</div>'
        );
      }

      const isPet = (slot.type === 'pet');
      const name = item.name;
      let img = item.img || (isPet ? ('assets/pets/' + item.id + '.webp') : ('assets/artifacts/' + item.id + '.webp'));
      if (!img.startsWith('assets/')) {
        img = (isPet ? 'assets/pets/' : 'assets/artifacts/') + img;
      }
      const tag = slot.label;

      return (
        '<div class="prf-card-chassis support-chassis" onclick="inspectSupport(\'' + slot.type + '\', \'' + item.id + '\')" title="' + name + '">' +
          '<div class="pcc-top-bar">' +
            '<span class="pcc-support-tag">' + tag + '</span>' +
          '</div>' +
          '<div class="pcc-art-shell support-art">' +
            '<div class="pcc-cyber-grid"></div>' +
            '<svg class="relic-bg-mandala" viewBox="0 0 100 100">' +
              '<circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="5 3"/>' +
              '<circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
              '<polygon points="50,15 80,68 20,68" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
              '<polygon points="50,85 80,32 20,32" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
            '</svg>' +
            '<div class="relic-pedestal"></div>' +
            '<img src="' + img + '" alt="' + name + '" class="relic-icon">' +
            '<div class="pcc-vignette"></div>' +
          '</div>' +
          '<div class="pcc-plate">' +
            '<div class="pcc-name">' + name + '</div>' +
          '</div>' +
          '<span class="pcc-crn tl"></span><span class="pcc-crn br"></span>' +
        '</div>'
      );
    }).join('');

    teamSuppEl.innerHTML = suppHtml;
  }

  // 5. Extra Page Telemetry (100% Real Player Data)
  const extraKoleksi=document.getElementById("profExtraKoleksi");
  if(extraKoleksi){
    const st=Array.isArray(state.stacks)?state.stacks:[];
    let copies=0, shiny=0, rainbow=0, secret=0, ultima=0; const uni=new Set();
    for(const s of st){
      const c=s.count||1; copies+=c; uni.add(s.char);
      if(s.shiny) shiny+=c;
      const m=s.mut||"none";
      if(m==="rainbow") rainbow+=c;
      else if(m==="secret") secret+=c;
      else if(m==="ultima") ultima+=c;
    }
    const totalCards=(typeof MASTER_CARD_INDEX!=="undefined"?MASTER_CARD_INDEX:[]).filter(c=>!c.isStoryEnemy).length||75;

    extraKoleksi.innerHTML = 
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">UNIQUE DISCOVERED</span>' +
        '<span class="prf-extra-tile-v" style="color:var(--cyan)">' + uni.size + ' / ' + totalCards + '</span>' +
      '</div>' +
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">TOTAL COPIES</span>' +
        '<span class="prf-extra-tile-v">' + fmt(copies) + '</span>' +
      '</div>' +
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">SHINY CARDS</span>' +
        '<span class="prf-extra-tile-v" style="color:var(--haz)">' + fmt(shiny) + '</span>' +
      '</div>' +
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">RAINBOW MUTATION</span>' +
        '<span class="prf-extra-tile-v" style="color:#ec4899">' + fmt(rainbow) + '</span>' +
      '</div>' +
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">SECRET MUTATION</span>' +
        '<span class="prf-extra-tile-v" style="color:#a855f7">' + fmt(secret) + '</span>' +
      '</div>' +
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">ULTIMA MUTATION</span>' +
        '<span class="prf-extra-tile-v" style="color:#ff3366">' + fmt(ultima) + '</span>' +
      '</div>';
  }

  const extraProgres=document.getElementById("profExtraProgres");
  if(extraProgres){
    const cd=(state.clearedDiff&&typeof state.clearedDiff==="object")?state.clearedDiff:{};
    const apocClears=Object.keys(cd["apocalypse"]||{}).length;
    extraProgres.innerHTML = 
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">INFINITE TOWER</span>' +
        '<span class="prf-extra-tile-v" style="color:var(--haz)">Floor ' + ((state.tower&&state.tower.best)||0) + '</span>' +
      '</div>' +
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">STORY APOCALYPSE</span>' +
        '<span class="prf-extra-tile-v">' + (apocClears > 0 ? ('Cleared ' + apocClears + '/8') : 'IN PROGRESS') + '</span>' +
      '</div>' +
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">WORLD BOSS DMG</span>' +
        '<span class="prf-extra-tile-v" style="color:#ff4d5e">' + fmt(state.wbDamage||0) + '</span>' +
      '</div>' +
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">REBIRTH CYCLE</span>' +
        '<span class="prf-extra-tile-v" style="color:#c084fc">Cycle R' + rb + ' (×' + mult + ' LUCK)</span>' +
      '</div>';
  }

  const extraEkuipmen=document.getElementById("profExtraEkuipmen");
  if(extraEkuipmen){
    const artTotal=typeof ART_DEFS!=="undefined"?ART_DEFS.length:0;
    const petTotal=typeof PET_DEFS!=="undefined"?PET_DEFS.length:0;
    extraEkuipmen.innerHTML = 
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">ARTIFACTS OWNED</span>' +
        '<span class="prf-extra-tile-v" style="color:var(--cyan)">' + (state.artOwned||[]).length + ' / ' + artTotal + '</span>' +
      '</div>' +
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">PETS OWNED</span>' +
        '<span class="prf-extra-tile-v" style="color:var(--haz)">' + (state.petOwned||[]).length + ' / ' + petTotal + '</span>' +
      '</div>';
  }

  const extraItems=document.getElementById("profExtraItems");
  if(extraItems){
    const wAct=(state.weather&&Date.now()<state.weather.endsAt)?WEATHER[state.weather.id]:null;
    extraItems.innerHTML = 
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">COINS</span>' +
        '<span class="prf-extra-tile-v" style="color:var(--gold)">' + fmt(state.coins||0) + '</span>' +
      '</div>' +
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">WB TOKENS</span>' +
        '<span class="prf-extra-tile-v" style="color:#ff4d5e">' + fmt(state.wbTokens||0) + '</span>' +
      '</div>' +
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">INF TOKENS</span>' +
        '<span class="prf-extra-tile-v" style="color:var(--cyan)">' + fmt(state.infTokens||0) + '</span>' +
      '</div>' +
      '<div class="prf-extra-tile">' +
        '<span class="prf-extra-tile-k">ACTIVE WEATHER</span>' +
        '<span class="prf-extra-tile-v">' + (wAct ? wAct.name : 'INACTIVE') + '</span>' +
      '</div>';
  }
}
function hideRollResult() {
  if (rollState.showcase) return; /* showcase terbuka: klaim dulu, jangan hilangkan reveal di belakangnya */
  /* hide saat auto jalan = sembunyi permanen sampai auto start lagi; hide manual = tutup saja,
     roll manual berikutnya tetap reveal (perilaku prototipe). Layar lain dijaga CSS !important. */
  rollState.hideOverlay = !!rollState.active;
  const overlay = document.getElementById('rollOverlay');
  if (!overlay) return;

  const reveal = document.getElementById('rollReveal');
  if (reveal) {
    reveal.style.transition = 'all 0.3s ease-out';
    reveal.style.opacity = '0';
    reveal.style.transform = 'scale(0.94)';
  }

  rollState.fadeTimer = setTimeout(() => {
    rollState.fadeTimer = null;
    overlay.style.display = 'none';
    if (reveal) {
      reveal.style.opacity = '';
      reveal.style.transform = '';
      reveal.style.transition = '';
      reveal.classList.remove('on', 'slam', 'settled');
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
let bpTab = "item"; /* tab Backpack: item | artefact | pet (deck pindah ke #deckModal) */
/* bpSetTab: DECK & SKILL TREE sudah keluar dari Backpack (2026-11-07).
   DECK punya layar sendiri (#deckModal) jadi permintaan 'deck' dialihkan ke sana;
   'tree' dan nilai tak dikenal jatuh ke tab ITEM sampai layar pohon skill dibuat. */
function bpSetTab(t){
  if(t==='deck'){
    if(typeof openDeckModal==='function'){try{openDeckModal();}catch(e){}return;}
    t='item';
  }
  if(t!=='item'&&t!=='artefact'&&t!=='pet')t='item';
  bpTab=t;bpTarget=null;bpItemPopClose();
  if(typeof window.bpxSetTab==='function'){try{window.bpxSetTab(t);}catch(e){}}
  renderBackpackPanel();
}
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
/* EQUIP BEST: isi 4 slot dek dengan varian PALING LANGKA di koleksi.
   Rarity = luckChance() (penyebut "1 in X" — makin besar makin langka) dan sudah
   termasuk pengali mutasi × shiny; seri dipecah power varian (HP+ATK) lalu id. */
function bpEquipBest(){
  const list=(state.stacks||[]).filter(s=>s&&s.char&&CARDS[s.char]);
  if(!list.length)return;
  list.sort((a,b)=>luckChance(b.char,b.mut,b.shiny)-luckChance(a.char,a.mut,a.shiny)||bpPowerOf(b)-bpPowerOf(a)||String(a.id).localeCompare(String(b.id)));
  const next=[null,null,null,null];
  list.slice(0,4).forEach((s,i)=>{next[i]=s.id;});
  state.deck=next;
  state.equippedId=next[0]||null;
  state.equippedId2=next[1]||null;
  bpTarget=null;
  save();
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
  if(rootEl.__lzSc){try{rootEl.removeEventListener('scroll',rootEl.__lzSc);}catch(e){}rootEl.__lzSc=null;}
  const phs=[].slice.call(rootEl.querySelectorAll('.lz-ph'));
  if(!phs.length){rootEl.__lzFlush=null;return;}
  const buf=opts.prefetch||300;
  const fill=el=>{if(!el.classList.contains('lz-ph'))return;const k=el.getAttribute('data-lz');el.innerHTML=(htmlMap[k]!=null?htmlMap[k]:'');el.classList.remove('lz-ph');};
  const flush=()=>{
    const r=rootEl.getBoundingClientRect();
    const useWin=!r.height;
    const top=(useWin?0:r.top)-buf,bot=(useWin?window.innerHeight:r.bottom)+buf;
    let rem=0;
    for(let i=0;i<phs.length;i++){
      const el=phs[i];
      if(!el.classList.contains('lz-ph'))continue;
      if(el.style.display==='none'){rem++;continue;}
      const er=el.getBoundingClientRect();
      if(er.width&&er.height&&er.bottom>=top&&er.top<=bot)fill(el);
      else rem++;
    }
    if(!rem){
      if(rootEl.__lzIO){try{rootEl.__lzIO.disconnect();}catch(e){}rootEl.__lzIO=null;}
      if(rootEl.__lzSc){try{rootEl.removeEventListener('scroll',rootEl.__lzSc);}catch(e){}rootEl.__lzSc=null;}
    }
  };
  rootEl.__lzFlush=flush;
  if(!('IntersectionObserver'in window)){phs.forEach(fill);return;}
  const canRoot=rootEl.clientHeight>0&&/(auto|scroll)/.test(getComputedStyle(rootEl).overflowY);
  const io=new IntersectionObserver(entries=>{
    entries.forEach(en=>{if(en.isIntersecting){fill(en.target);io.unobserve(en.target);}});
  },{root:canRoot?rootEl:null,rootMargin:buf+'px 0px'});
  rootEl.__lzIO=io;
  phs.forEach(el=>io.observe(el));
  rootEl.__lzSc=()=>requestAnimationFrame(flush);
  rootEl.addEventListener('scroll',rootEl.__lzSc,{passive:true});
  requestAnimationFrame(flush);
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

  const shStamp = s.shiny ? (typeof shinyStampHtml === 'function' ? shinyStampHtml(true) : '') : '';
  const mStamp = mut ? (typeof mutStampHtml === 'function' ? mutChip(mut, mutStampHtml(mut, true)) : '') : '';
  const tStamp = trait ? traitChip(trait, typeof traitStampHtml === 'function' ? traitStampHtml(trait, true) : `<span class="hc-trait hc-gem bpt-gem" style="color:${TRAIT_COLOR[trait]};border-color:${TRAIT_COLOR[trait]}">${traitGem(12,trait)}</span>`) : '';
  const badgesHtml = (shStamp || mStamp || tStamp)
    ? `<div class="hc-badges bpt-top">${shStamp}${mStamp}${tStamp}</div>`
    : '';

  const bcol = mut ? MUT_COLOR[mut] : ((tier && TIER_COLOR[tier]) || '#7DF9FF');
  const hzCls = (typeof hzBorderCls === 'function') ? hzBorderCls(mut, !!s.shiny, { tile: true, dense: true }) : '';
  const hzLayers = (typeof hzBorderLayerHtml === 'function') ? hzBorderLayerHtml() : '';
  return `<div class="hub-center bp-card-hub${cData.fullArt?' fa':''}${mut?' mut-'+mut:''}${shinyCls(s)}${hzCls}" data-tier="${tier}" style="--tcol:${bcol};box-sizing:border-box;width:100%;height:100%;aspect-ratio:inherit;overflow:hidden;position:relative;">
      ${hzLayers}
      <div class="hc-img" style="position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit;">
        <img src="${cardThumb(s.char)}" alt="${cName}" width="360" height="536" decoding="async"${cData.pos?` style="object-position:${cData.pos}"`:''}>
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
/* ==========================================================================
   BACKPACK HAZARD (port _tmp/proto_backpack_v4.html, dikunci user 2026-11-07)
   Tab DECK & SKILL TREE keluar dari Backpack:
     - DECK  -> layar sendiri (#deckModal, js/deck-modal.js)
     - TREE  -> akan jadi layar sendiri
   Tab CURRENCY / INTAN tidak ada (INTAN ROLL tidak ditampilkan di sini).
   Tersisa 3 tab: 01 ITEMS · 02 ARTEFACTS · 03 COMPANION PETS.

   Bentuk: rail kategori kiri + grid tile 1:1 + dossier kanan (overlay di HP).

   PRESENTASI SAJA — angka & aksi tetap memakai helper core yang sudah ada:
     bpItemDef · bpPackRollAmountOf · bpUseRollPack · bpUsePotion ·
     bpUseLuckPotion · bpUseSpeedPotion · bpToggleArt · bpTogglePet ·
     bpBuyArt · bpBuyPet · bpGearStatus · ART_DEFS · PET_DEFS ·
     totalLuck · luckTxt · thumbSrc
   Catatan: renderBpItems/renderBpArts/renderBpPets lama TIDAK dipakai lagi
   oleh layar ini, tapi dibiarkan utuh (masih dipakai layar lain kalau ada).
   ========================================================================== */
let bpxCat='all', bpxSel=null, bpxStep=1, bpxSort='CATEGORY', bpxQuery='';
const BPX_ITEM_KINDS=['luck1','luck2','luck3','speed1','speed2','speed3','r5k','r10k','r25k','r50k','r100k'];
const BPX_TABS=[
  {k:'item',num:'01',l:'POTION & ITEMS',s:'ITEMS',ic:'assets/icons/potion-ball.svg'},
  {k:'artefact',num:'02',l:'ARTEFACTS',s:'RELICS',ic:'assets/icons/crown.svg'},
  {k:'pet',num:'03',l:'COMPANION PETS',s:'PETS',ic:'assets/icons/spiked-dragon-head.svg'}
];
const BPX_CATS_ITEM=[{k:'all',l:'ALL'},{k:'potions',l:'POTIONS'},{k:'packs',l:'ROLL PACKS'}];
function bpxCats(tab){
  if(tab==='item')return BPX_CATS_ITEM;
  return [{k:'all',l:'ALL'},{k:'owned',l:'OWNED'},{k:'equipped',l:tab==='pet'?'ACTIVE':'EQUIPPED'}];
}
function bpxItemCat(kind){
  return (kind==='potion'||kind.indexOf('luck')===0||kind.indexOf('speed')===0)?'potions':'packs';
}
function bpxItems(){
  const out=[];
  BPX_ITEM_KINDS.forEach(k=>{const d=bpItemDef(k);if(d)out.push(d);});
  return out;
}
function bpxGearIcon(d){
  if(d.img)return thumbSrc(d.img)||d.img;
  return 'assets/artefacts/'+d.id+'.webp';
}
function bpxKey(d){ return d.id || d.kind; }
function bpxList(tab){
  if(tab==='artefact')return ART_DEFS.slice();
  if(tab==='pet')return PET_DEFS.slice();
  return bpxItems();
}
function bpxOwned(tab,d){
  if(tab==='artefact')return (state.artOwned||[]).indexOf(d.id)>=0;
  if(tab==='pet')return (state.petOwned||[]).indexOf(d.id)>=0;
  return (d.cnt||0)>0;
}
function bpxActive(tab,d){
  if(tab==='artefact')return (state.artSlots||[]).indexOf(d.id)>=0;
  if(tab==='pet')return state.petEquipped===d.id;
  return false;
}
function bpxFilter(tab){
  const q=bpxQuery, out=[];
  bpxList(tab).forEach(d=>{
    if(bpxCat!=='all'){
      if(tab==='item'){ if(bpxItemCat(d.kind)!==bpxCat)return; }
      else if(bpxCat==='owned'){ if(!bpxOwned(tab,d))return; }
      else if(bpxCat==='equipped'){ if(!bpxActive(tab,d))return; }
    }
    if(q&&String(d.name).toLowerCase().indexOf(q)<0)return;
    out.push(d);
  });
  out.sort((a,b)=>{
    if(bpxSort==='NAME')return String(a.name).localeCompare(String(b.name));
    return ((bpxActive(tab,b)?1:0)-(bpxActive(tab,a)?1:0))||((bpxOwned(tab,b)?1:0)-(bpxOwned(tab,a)?1:0));
  });
  return out;
}
function bpxCatCount(tab,k){
  const list=bpxList(tab);
  if(k==='owned')return list.filter(d=>bpxOwned(tab,d)).length;
  if(k==='equipped')return tab==='artefact'?(state.artSlots||[]).filter(Boolean).length:(state.petEquipped?1:0);
  if(tab==='item'&&k!=='all')return list.filter(d=>bpxItemCat(d.kind)===k).length;
  return list.length;
}
function bpxTile(tab,d){
  const owned=bpxOwned(tab,d), act=bpxActive(tab,d);
  const key=bpxKey(d);
  const on=bpxSel===tab+':'+key;
  let badge='';
  if(tab==='item'){ if(d.isPack)badge='<span class="bpn-tag">PACK</span>'; }
  else if(act)badge='<span class="bpn-tag cy">'+(tab==='pet'?'ACTIVE':'EQUIPPED')+'</span>';
  const corner=(tab==='item')
    ?'<span class="bpn-qty'+(owned?'':' zero')+'">×'+fmt(d.cnt||0)+'</span>'
    :'<span class="bpn-qty'+(owned?'':' zero')+'">'+(owned?'OWNED':'LOCKED')+'</span>';
  const icon=(tab==='item')?(d.icon||'assets/sprites/_placeholder.svg'):bpxGearIcon(d);
  const nmCol=(tab!=='item'&&owned&&d.color)?' style="color:'+d.color+'"':'';
  return '<button type="button" class="bpn-tile'+(on?' on':'')+(owned?'':' off')+'" data-bpx-id="'+key+'" aria-label="'+d.name+'" onclick="bpxPick(\''+tab+'\',\''+key+'\')">'
    +corner+badge
    +'<span class="bpn-tile-art"><img src="'+icon+'" alt="" width="72" height="72" decoding="async" onerror="this.onerror=null;this.src=\'assets/images/icon-index-card.webp\'"></span>'
    +'<span class="bpn-tile-nm"'+nmCol+'>'+d.name+'</span></button>';
}
function bpxFindSelected(){
  if(!bpxSel)return null;
  const p=bpxSel.split(':');
  if(p[0]==='item'){let f=null;bpxItems().forEach(d=>{if(d.kind===p[1])f=d;});return f;}
  return (p[0]==='pet'?PET_DEFS:ART_DEFS).find(x=>x.id===p[1])||null;
}
function bpxActionLabel(d){
  if(d.isPack&&d.kind!=='intan'){
    const amt=(typeof bpPackRollAmountOf==='function'?bpPackRollAmountOf(d.kind):0)||0;
    return 'ROLL '+fmt(bpxStep*amt)+' CARDS';
  }
  return 'USE '+bpxStep+'×';
}
function bpxDossierEmpty(){
  return '<div class="bpn-det-head"><span class="kick">// INVENTORY <b>DOSSIER</b></span></div>'
    +'<div class="bpn-det-empty"><span class="de-ic">'
    +'<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>'
    +'</span><span class="de-t">SELECT AN ENTRY<br>TO INSPECT</span></div>';
}
function bpxDossierItem(d){
  const cap=Math.max(1,d.cnt||0);
  if(bpxStep>cap)bpxStep=cap;
  const has=(d.cnt||0)>0;
  const cat=d.isPack?'SPECIAL ROLL PACK':(d.kind==='potion'?'WEATHER CATALYST':(d.kind.indexOf('luck')===0?'LUCK ENHANCER':'SPEED OVERCLOCK'));
  return '<div class="bpn-det-head"><span class="kick">// ITEM <b>DOSSIER</b></span>'
    +'<button type="button" class="bpn-det-x" onclick="bpxCloseDossier()" aria-label="Close dossier">'
    +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg></button></div>'
    +'<div class="bpn-det-art"><span class="bpn-det-pedestal"></span><img src="'+(d.icon||'assets/sprites/_placeholder.svg')+'" alt="'+d.name+'"></div>'
    +'<div class="bpn-det-body">'
    +'<div class="bpn-det-name">'+d.name+'</div>'
    +'<div class="bpn-det-chipwrap"><span class="bpn-det-chip">'+cat+'</span></div>'
    +'<p class="bpn-det-desc">'+(d.desc||'')+'</p>'
    +(d.active?'<p class="bpn-det-desc">'+d.active+'</p>':'')
    +'<div class="bpn-det-stats">'
    +'<div class="bpn-det-stat hot"><k>YOU OWN</k><v>'+fmt(d.cnt||0)+'×</v></div>'
    +'<div class="bpn-det-stat"><k>AMOUNT</k><v>'+bpxStep+'</v></div>'
    +'</div>'
    +'<div class="bpn-stepper">'
    +'<button type="button" class="bpn-step" onclick="bpxStepBy(-1)"'+(bpxStep<=1?' disabled':'')+' aria-label="Decrease amount">−</button>'
    +'<span class="bpn-range"><input type="range" min="1" max="'+cap+'" value="'+bpxStep+'" oninput="bpxStepSet(this.value)" aria-label="Amount"></span>'
    +'<span class="bpn-stepval">'+bpxStep+'</span>'
    +'<button type="button" class="bpn-step" onclick="bpxStepBy(1)"'+(bpxStep>=cap?' disabled':'')+' aria-label="Increase amount">+</button>'
    +'</div>'
    +'<div class="bpn-actions">'
    +'<button type="button" class="bpn-btn pri" onclick="bpxUseSelected()"'+(has?'':' disabled')+'>'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
    +'<span>'+bpxActionLabel(d)+'</span></button>'
    +(d.isPack&&d.kind!=='intan'?'<button type="button" class="bpn-btn" onclick="bpxOpenItemPop(\''+d.kind+'\')">AMOUNT OPTIONS / USE ALL</button>':'')
    +'</div></div>'
    +'<div class="bpn-det-foot">Every use is validated against your saved balance.</div>';
}
function bpxDossierGear(tab,d){
  const isPet=tab==='pet';
  const owned=bpxOwned(tab,d), act=bpxActive(tab,d);
  const chip=act?(isPet?'ACTIVE PET':'EQUIPPED · SLOT '+((state.artSlots||[]).indexOf(d.id)+1)):(owned?'OWNED':'NOT OWNED');
  let actions;
  if(act)actions='<button type="button" class="bpn-btn warn" onclick="bpxGear(\''+tab+'\',\''+d.id+'\',\'off\')">RELEASE</button>';
  else if(owned)actions='<button type="button" class="bpn-btn pri" onclick="bpxGear(\''+tab+'\',\''+d.id+'\',\'on\')">EQUIP</button>';
  else{
    const st=(typeof bpGearStatus==='function')?bpGearStatus(d,false,false):{t:'LOCKED'};
    actions='<button type="button" class="bpn-btn" onclick="bpxGear(\''+tab+'\',\''+d.id+'\',\'buy\')">ACQUIRE · '+st.t+'</button>';
  }
  return '<div class="bpn-det-head"><span class="kick">// '+(isPet?'PET':'RELIC')+' <b>DOSSIER</b></span>'
    +'<button type="button" class="bpn-det-x" onclick="bpxCloseDossier()" aria-label="Close dossier">'
    +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg></button></div>'
    +'<div class="bpn-det-art"><span class="bpn-det-pedestal"></span><img src="'+bpxGearIcon(d)+'" alt="'+d.name+'"></div>'
    +'<div class="bpn-det-body">'
    +'<div class="bpn-det-name">'+d.name+'</div>'
    +'<div class="bpn-det-chipwrap"><span class="bpn-det-chip"'+(d.color?' style="color:'+d.color+'"':'')+'>'+chip+'</span></div>'
    +'<p class="bpn-det-desc">'+(isPet?'Companion pet — only one can be active at a time. Its luck bonus is always counted while equipped.':'Permanent relic — up to two can be equipped at once. Only slotted relics contribute their luck bonus.')+'</p>'
    +'<div class="bpn-det-stats">'
    +'<div class="bpn-det-stat hot"><k>LUCK FLAT</k><v>+'+(d.flat||0)+'</v></div>'
    +'<div class="bpn-det-stat"><k>LUCK MULT</k><v>+'+(d.pct||0)+'%</v></div>'
    +'</div>'
    +'<div class="bpn-actions">'+actions+'</div></div>'
    +'<div class="bpn-det-foot">'+luckTxt(d)+'</div>';
}
function bpxDossier(){
  if(!bpxSel)return bpxDossierEmpty();
  const d=bpxFindSelected();
  if(!d)return bpxDossierEmpty();
  return bpxSel.indexOf('item:')===0?bpxDossierItem(d):bpxDossierGear(bpxSel.split(':')[0],d);
}
function bpxPaintBody(){
  const tab=bpTab;
  const cats=bpxCats(tab);
  let rail='<div class="bpn-rail-h"><b>CATEGORIES</b><span class="rule"></span></div>', chips='';
  cats.forEach(c=>{
    const n=bpxCatCount(tab,c.k);
    rail+='<button type="button" class="bpn-cat'+(bpxCat===c.k?' on':'')+'" onclick="bpxSetCat(\''+c.k+'\')"><span>'+c.l+'</span><span class="cn">'+n+'</span></button>';
    chips+='<button type="button" class="bpn-chip'+(bpxCat===c.k?' on':'')+'" onclick="bpxSetCat(\''+c.k+'\')">'+c.l+' <b>'+n+'</b></button>';
  });
  rail+='<div class="bpn-tip"><b>TIP</b>Click an entry to open its dossier. Owned entries are listed first.</div>';
  const list=bpxFilter(tab);
  const tiles=list.map(d=>bpxTile(tab,d)).join('');
  const lbl=(BPX_TABS.find(t=>t.k===tab)||BPX_TABS[0]).l;
  return '<div class="bpn-body">'
    +'<aside class="bpn-rail">'+rail+'</aside>'
    +'<div class="bpn-mid">'
    +'<div class="bpn-chips">'+chips+'</div>'
    +'<div class="bpn-tools">'
    +'<label class="bpn-search">'
    +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>'
    +'<input type="search" placeholder="Search inventory..." value="'+bpxQuery+'" oninput="bpxSetQuery(this.value)" autocomplete="off">'
    +'</label>'
    +'<button type="button" class="bpn-sort'+(bpxSort!=='CATEGORY'?' on':'')+'" onclick="bpxToggleSort()">SORT <span class="cv">'+bpxSort+'</span></button>'
    +'</div>'
    +'<div class="bpn-scroll"><div class="bpn-grid">'+tiles+'</div>'
    +'<div class="bpn-nr"'+(list.length?' style="display:none"':'')+'>NO MATCHING ENTRY</div></div>'
    +'</div>'
    +'<aside class="bpn-detail'+(bpxSel?' on':'')+'" id="bpxDetail">'+bpxDossier()+'</aside>'
    +'</div>'
    +'<footer class="bpn-foot">'
    +'<span><b>CLICK ITEM</b> open dossier</span>'
    +'<span><b>STEPPER</b> pick amount</span>'
    +'<span class="haz">TAB · '+lbl+'</span></footer>';
}
function _bpxUrl(p){try{return new URL(p,document.baseURI||location.href).href;}catch(e){return p;}}
function bpxPaintTabs(){
  return '<nav class="bpn-tabs" role="tablist" aria-label="Bagian Backpack">'
    +BPX_TABS.map(t=>'<button type="button" class="bpn-tab'+(bpTab===t.k?' on':'')+'" role="tab" aria-selected="'+(bpTab===t.k)+'" onclick="bpxSetTab(\''+t.k+'\')">'
      +'<span class="bpn-tab-num">'+t.num+'</span>'
      +'<span class="bpn-tab-ic" style="--im:url(\''+_bpxUrl(t.ic)+'\')"></span>'
      +'<span class="bpn-tab-l">'+t.l+'</span>'
      +'<span class="bpn-tab-s">'+t.s+'</span></button>').join('')
    +'</nav>';
}
function bpxPaintHeader(){
  const owned=bpxItems().filter(d=>(d.cnt||0)>0).length;
  return '<header class="bpn-top">'
    +'<div class="bpn-mark"><span class="bpn-mark-t">BACKPACK</span><span class="bpn-mark-s">FIELD INVENTORY</span></div>'
    +'<div class="bpn-topmid">'
    +'<div class="bpn-crumb"><i></i><span>VAULT</span><span class="sep">/</span><b>HZ-04</b><span class="sep">/</span><span>SUPPLY</span></div>'
    +'<div class="bpn-topstat">'
    +'<div class="bpn-ts"><span class="bpn-ts-k">OWNED</span><span class="bpn-ts-v am">'+fmt(owned)+'</span></div>'
    +'<div class="bpn-ts"><span class="bpn-ts-k">LUCK</span><span class="bpn-ts-v">'+fmt(totalLuck())+'</span></div>'
    +'</div></div>'
    +'<button class="bpn-x" onclick="toggleBackpack()" aria-label="Close Backpack" title="Close [ESC]">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg></button></header>';
}
function bpxRepaint(){
  const p=document.getElementById('backpackPanel');if(!p)return;
  p.innerHTML=bpxPaintHeader()+bpxPaintTabs()+bpxPaintBody();
}
function bpxRefreshGrid(){
  const grid=document.querySelector('#backpackPanel .bpn-grid');if(!grid)return;
  const list=bpxFilter(bpTab);
  grid.innerHTML=list.map(d=>bpxTile(bpTab,d)).join('');
  const nr=document.querySelector('#backpackPanel .bpn-nr');if(nr)nr.style.display=list.length?'none':'block';
  bpxRefreshDossier();
}
function bpxRefreshDossier(){
  const el=document.getElementById('bpxDetail');if(!el)return;
  el.innerHTML=bpxDossier();
  el.classList.toggle('on',!!bpxSel);
}
function bpxMarkSel(){
  document.querySelectorAll('#backpackPanel .bpn-tile').forEach(t=>{
    const id=t.getAttribute('data-bpx-id');
    t.classList.toggle('on',!!id&&bpxSel===bpTab+':'+id);
  });
}
function bpxSetTab(k){
  if(k!=='item'&&k!=='artefact'&&k!=='pet')k='item';
  bpTab=k;bpxCat='all';bpxQuery='';bpxSel=null;bpxStep=1;
  bpxRepaint();
}
function bpxSetCat(k){bpxCat=k;bpxSel=null;bpxStep=1;bpxRepaint();}
function bpxSetQuery(v){bpxQuery=String(v||'').trim().toLowerCase();bpxSel=null;bpxRefreshGrid();}
function bpxToggleSort(){bpxSort=(bpxSort==='CATEGORY')?'NAME':'CATEGORY';bpxRepaint();}
function bpxPick(tab,id){bpxSel=tab+':'+id;bpxStep=1;bpxMarkSel();bpxRefreshDossier();}
function bpxCloseDossier(){bpxSel=null;bpxMarkSel();bpxRefreshDossier();}
function bpxStepSet(v){bpxStep=Math.max(1,parseInt(v,10)||1);bpxRefreshDossier();}
function bpxStepBy(dv){
  const d=bpxFindSelected();if(!d||bpTab!=='item')return;
  const cap=Math.max(1,d.cnt||0);
  bpxStep=Math.min(cap,Math.max(1,bpxStep+dv));
  bpxRefreshDossier();
}
function bpxUseSelected(){
  const d=bpxFindSelected();if(!d||bpTab!=='item')return;
  const n=Math.min(bpxStep,d.cnt||0);if(n<=0)return;
  if(d.isPack&&d.kind!=='intan'){bpUseRollPack(d.kind,bpPackRollAmountOf(d.kind),n);return;}
  if(d.kind==='potion'){bpMultiN=n;bpUsePotion();return;}
  if(d.kind.indexOf('luck')===0){bpUseLuckPotion(+d.kind.charAt(4),n);return;}
  if(d.kind.indexOf('speed')===0){bpUseSpeedPotion(+d.kind.charAt(5),n);}
}
function bpxOpenItemPop(kind){ try{ bpItemPop(kind); }catch(e){} }
function bpxGear(tab,id,mode){
  if(mode==='on'||mode==='off'){
    if(tab==='pet')bpTogglePet(id); else bpToggleArt(id);
    bpxSel=null;bpxRepaint();return;
  }
  if(mode==='buy'){ if(tab==='pet')bpBuyPet(id); else bpBuyArt(id); }
}
/* ESC berjenjang: dossier dulu, baru panel (boot.js mengurus sisanya). */
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape'||!bpxSel)return;
  if(!document.body.classList.contains('bp-open'))return;
  e.stopPropagation();e.preventDefault();bpxCloseDossier();
},true);

/* ---- banner hazard masuk/keluar (#backpackCurtain, pola #deckCurtain) ---- */
let _bpxT=[];
function bpxClearT(){for(const t of _bpxT)clearTimeout(t);_bpxT=[];}
function bpxSetCopy(mode){
  const kick=document.getElementById('bpHZKick'),title=document.getElementById('bpHZTitle'),
        sub=document.getElementById('bpHZSub'),foot=document.getElementById('bpHZFoot'),
        serial=document.getElementById('bpHZSerial'),water=document.getElementById('bpHZWater');
  if(serial)serial.textContent=(0x1000+Math.floor(Math.random()*0xefff)).toString(16).toUpperCase();
  if(mode==='open'){
    if(kick)kick.innerHTML='// SUPPLY <b>UPLINK</b>';
    if(title)title.textContent='BACKPACK';
    if(water)water.textContent='BAG';
    if(sub)sub.textContent='INVENTORY MATRIX · ITEMS · RELICS · PETS';
    if(foot)foot.textContent='SYNC INVENTORY';
  }else{
    if(kick)kick.innerHTML='// LINK <b>STAND BY</b>';
    if(title)title.textContent='HOLD';
    if(water)water.textContent='OUT';
    if(sub)sub.textContent='INVENTORY DISCONNECTING · DATA SAVED';
    if(foot)foot.textContent='CLOSE SESSION';
  }
}
function bpxBannerOpen(){
  const c=document.getElementById('backpackCurtain');if(!c)return;
  bpxClearT();bpxSetCopy('open');
  c.className='';void c.offsetWidth;
  c.classList.add('on','smooth','sweep');
  _bpxT.push(setTimeout(()=>c.classList.add('revealed'),1080));
  _bpxT.push(setTimeout(()=>c.classList.remove('on','smooth','sweep','revealed'),1800));
}
/* EXIT 3 fase: tirai MENUTUP -> konten disembunyikan -> tirai MEMBUKA.
   Fase 3 wajib; tanpanya layar tertahan tertutup ("banner tidak kebuka"). */
function bpxBannerClose(onCovered){
  const c=document.getElementById('backpackCurtain');
  if(!c){if(onCovered)onCovered();return;}
  bpxClearT();bpxSetCopy('close');
  c.className='';c.classList.add('on','smooth','revealed');void c.offsetWidth;
  c.classList.remove('revealed');
  _bpxT.push(setTimeout(()=>{if(onCovered)onCovered();},560));
  _bpxT.push(setTimeout(()=>c.classList.add('revealed'),780));
  _bpxT.push(setTimeout(()=>c.classList.remove('on','smooth','revealed'),1560));
}
window.bpxBannerOpen=bpxBannerOpen;
window.bpxBannerClose=bpxBannerClose;

function renderBackpackPanel(){
  const panel=document.getElementById('backpackPanel');if(!panel)return;
  /* DECK & SKILL TREE sudah keluar dari Backpack (2026-11-07). */
  try{ bpCardModalClose(); }catch(e){}
  bpxRepaint();
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
      <button class="bp-cm-x" onclick="bpCardModalClose()" aria-label="Close" title="Close [ESC]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
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
          <div class="bp-cm-own${slot>=0?' on':''}">${slot>=0?'IN DECK · SLOT '+(slot+1):'OWNED'}</div>
        </div>
      </div>
      <div class="bp-cm-pass"><span class="bp-cm-k">PASSIVE</span><div class="bp-cm-skill">${c&&c.passive?c.passive.name:''}</div><p class="bp-cm-desc">${c&&c.passive?c.passive.desc:''}</p></div>
      <div class="bp-cm-acts">
        <button class="bp-cm-btn pri" onclick="bpAssign('${s.id}')">EQUIP</button>
        ${slot>=0?`<button class="bp-cm-btn warn" onclick="bpClearSlot(${slot})">UNEQUIP</button>`:''}
        <button class="bp-cm-btn gold${s.fav?' on':''}" onclick="bpFav('${s.id}')" aria-pressed="${!!s.fav}"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${BP_STAR_PATH}"/></svg><span>FAV</span></button>
        <button class="bp-cm-btn lockbtn${s.lock?' on':''}" onclick="bpLock('${s.id}')" aria-pressed="${!!s.lock}" title="${s.lock?'Unlock card':'Lock card'}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg><span>LOCK</span></button>
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
    desc:'Weather gacha with real odds and pity. A same-or-better result switches the active weather and resets the 5 minute timer; a worse result keeps it.',
    active:aw?`<br><strong style="color:${WEATHER[aw].color}">Active: <span style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle">${weatherSvg(aw,13)}</span> ${WEATHER[aw].name}</strong>`:'',use:'bpUsePotion()'};}
  if(kind.startsWith('luck')){const lv=+kind[4],d=LUCK_POTS[lv],b=activeLuckBuff(),bp=activeLuckBuffPct();return{kind,name:'LUCK POTION L'+lv,icon:thumbSrc(`assets/images/pot-luck-${lv}.webp`),emoji:'🍀',cnt:(state.luckPots&&state.luckPots[lv-1])||0,
    desc:`+${d.flat} flat luck${d.pct?` & +${Math.round(d.pct*100)}% luck`:''} for 5 minutes per potion. Stackable — effects add up and each potion extends the timer by 5 minutes.`,
    active:b||bp?`<br><strong style="color:#5eead4">Active: +${b} LUCK${bp?` · +${Math.round(bp*100)}%`:''}</strong>`:'',use:`bpUseLuckPotion(${lv},1)`,useAll:`bpUseLuckPotion(${lv},'all')`};}
  if(kind.startsWith('speed')){const lv=+kind.slice(-1),d=SPEED_POTS[lv],b=activeSpeedBuff();return{kind,name:'SPEED POTION L'+lv,icon:thumbSrc(`assets/images/pot-speed-${lv}.webp`),emoji:'⚡',cnt:(state.speedPots&&state.speedPots[lv-1])||0,
    desc:`Roll speed +${d.add.toFixed(1)}× for 5 minutes per potion (total cap ×20). Stackable — effects add up and each potion extends the timer by 5 minutes.`,
    active:b?`<br><strong style="color:#fcd34d">Active: +${b.toFixed(1)}× SPEED</strong>`:'',use:`bpUseSpeedPotion(${lv},1)`,useAll:`bpUseSpeedPotion(${lv},'all')`};}
  if(kind==='r5k'){return{kind,name:'INSTANT ROLL 5K',icon:'assets/images/instanpack-5k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r5k)||0,
    desc:'SPECIAL ROLL PACK - Contains 5,000 instant card rolls straight into your collection.',
    active:'',isPack:true,use:"bpUseRollPack('r5k', 5000, window.bpPackN)"};}
  if(kind==='r10k'){return{kind,name:'INSTANT ROLL 10K',icon:'assets/images/instanpack-10k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r10k)||0,
    desc:'SPECIAL ROLL PACK - Contains 10,000 instant card rolls straight into your collection.',
    active:'',isPack:true,use:"bpUseRollPack('r10k', 10000, window.bpPackN)"};}
  if(kind==='r25k'){return{kind,name:'INSTANT ROLL 25K',icon:'assets/images/instanpack-25k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r25k)||0,
    desc:'SPECIAL ROLL PACK - Contains 25,000 instant card rolls straight into your collection.',
    active:'',isPack:true,use:"bpUseRollPack('r25k', 25000, window.bpPackN)"};}
  if(kind==='r50k'){return{kind,name:'INSTANT ROLL 50K',icon:'assets/images/instanpack-50k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r50k)||0,
    desc:'SPECIAL ROLL PACK - Contains 50,000 instant card rolls straight into your collection.',
    active:'',isPack:true,use:"bpUseRollPack('r50k', 50000, window.bpPackN)"};}
  if(kind==='r100k'){return{kind,name:'INSTANT ROLL 100K',icon:'assets/images/instanpack-100k.webp?v=trans1',emoji:'📦',cnt:(state&&state.rollPacks&&state.rollPacks.r100k)||0,
    desc:'SPECIAL ROLL PACK - Contains 100,000 instant card rolls straight into your collection.',
    active:'',isPack:true,use:"bpUseRollPack('r100k', 100000, window.bpPackN)"};}
  if(kind==='intan'){return{kind,name:'INTAN ROLL 100K',icon:(state.intanRolls&&state.intanRolls>0?'assets/images/icon-index-card.webp':'assets/sprites/_placeholder.svg'),emoji:'💎',cnt:state.intanRolls||0,
    desc:'ITEM INDEX REWARD — granted automatically for every 5 card variants collected in the Card Index (all mutations and shiny variants count). Using one pulls 100,000 cards at once.',
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
  return `<div class="bp-itemcard${has?'':' off'}" data-item="${kind}" role="button" tabindex="0" aria-disabled="${has?'false':'true'}" aria-label="${d.name} · owned ×${fmt(d.cnt)}" onclick="bpItemPop('${kind}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();bpItemPop('${kind}');}"><span class="bi-qty${has?'':' zero'}">×${fmt(d.cnt)}</span><span class="bi-ic"><img src="${d.icon}" alt="${d.name}" decoding="async"></span><span class="bi-name">${d.name}</span><button type="button" class="bi-act${d.isPack?' roll':''}" onclick="event.stopPropagation();bpItemUse('${kind}')" ${has?'':'disabled'}>${d.isPack?'GULUNG':'PAKAI'}</button></div>`;
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
   hilang tinggi, pesannya "NO ACTIVE BUFFS". Early-return kalau tab lain yang aktif. */
function bpItemBuffTick(){
  const strip=document.getElementById('bpItemBuffStrip');if(!strip)return;
  const nums=strip.querySelectorAll('[data-bpcd]');if(!nums.length)return;
  let alive=0;
  nums.forEach(el=>{const rem=+el.getAttribute('data-bpcd')-Date.now();el.textContent=fmtCountdown(rem);if(rem>0)alive++;});
  if(!alive)strip.innerHTML='<span class="bk">ACTIVE BUFFS</span><span class="bnone">NO ACTIVE BUFF</span>';
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
  const multi=isGacha?`<div class="bpholo-multi-wrap"><div class="bpholo-multi-label">ROLL AMOUNT:</div><div class="wo-multi">${[1,5,25,100].map(n=>`<button data-n="${n}" class="${bpMultiN===n?'on':''}" onclick="bpSetMulti(${n})">${n}×</button>`).join('')}</div></div>`:'';
  const isPack=!!d.isPack;
  if(isPack){
    /* Inisialisasi pack counter & default multiplier */
    bpPopupKind=kind; bpPackCnt=d.cnt; bpPackRollAmount=(kind==='intan')?100000:bpPackRollAmountOf(kind);
    if(d.cnt>=10){ bpPackN=10; window.bpPackIsAll=false; }
    else if(d.cnt>0 && d.cnt<10){ bpPackN=d.cnt; window.bpPackIsAll=true; }
    else { bpPackN=1; window.bpPackIsAll=false; }
    window.bpPackN=bpPackN;
  }
  const packMulti=isPack?`<div class="bpholo-multi-wrap"><div class="wo-multi bp-pack-toggle">${PACK_MULTI_LIST.map(val => {
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
      <button class="bpholo-x" onclick="bpItemPopClose()" type="button" title="Close">
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
        <span class="bpholo-inv-lbl">AMOUNT OWNED:</span>
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
          <span>${isPack ? (window.bpPackIsAll ? ('USE ALL (' + fmt(bpPackN) + '× packs)') : ('USE NOW' + (bpPackN > 1 ? ' (' + fmt(bpPackN) + '× packs)' : ''))) : ('USE NOW' + (isGacha && bpMultiN > 1 ? ' (' + bpMultiN + '×)' : ''))}</span>
        </button>
        ${d.useAll&&d.cnt>1?`<button class="bpholo-btn-all" onclick="${d.useAll}">MERGE ALL (×${fmt(d.cnt)})</button>`:''}
        <button class="bpholo-btn-dismiss" onclick="bpItemPopClose()" type="button">CLOSE</button>
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
  return `<div class="bpholo-packinfo">USE <b>${fmt(packs)}</b> PACKS · TOTAL <b>${fmt(pulls)}</b> PULLS</div>`;
}
function bpSetPackN(n){
  const cnt = (typeof bpPackCnt === 'number') ? bpPackCnt : 0;
  if(n === 'ALL' || n === 'all'){
    if(cnt < 1){
      toast("OUT OF STOCK", "NO PACKS AVAILABLE", "#f87171");
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
      toast("NOT ENOUGH STOCK", "YOU HAVE " + fmt(cnt) + " PACKS", "#f87171");
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
      useSpan.textContent = `USE ALL (${fmt(bpPackN)}× packs)`;
    } else {
      useSpan.textContent = `USE NOW${bpPackN > 1 ? ' (' + fmt(bpPackN) + '× packs)' : ''}`;
    }
  }
}
window.bpSetPackN = bpSetPackN;
function bpSetMulti(n){
  bpMultiN=n;
  document.querySelectorAll('#itemPop .wo-multi button[data-n]').forEach(b=>b.classList.toggle('on',+b.dataset.n===n));
  const use=document.querySelector('#itemPop .bpi-use');
  if(use&&bpMultiN>1)use.textContent='USE ×'+bpMultiN;
  else if(use)use.textContent='USE';
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
    toast("Out of potions","NO POTIONS LEFT","#f87171");
    return;
  }
  if(n>1){
    const w=best||last;
    toast(`${w?`<span style="display:inline-flex;align-items:center;gap:6px">${weatherSvg(w.id,20)} ${w.name}</span>`:'GACHA ×'+done}`,`×${done} ROLL · ${switches} SWITCHED · ${kept} SKIPPED`,w?w.color:'#5eead4');
    if(switches)beep(520,.16,"triangle",.1),setTimeout(()=>beep(780,.18,"triangle",.1),120);
    else beep(240,.18,"sine",.07);
  }else if(last&&best===null&&kept){
    toast(`<span style="display:inline-flex;align-items:center;gap:6px">${weatherSvg(last.id,20)} ${last.name}</span>`,"WORSE ROLL · WEATHER KEPT",last.color);
    beep(240,.18,"sine",.07);
  }else{
    beep(520,.16,"triangle",.1);setTimeout(()=>beep(780,.18,"triangle",.1),120);
    toast(`<span style="display:inline-flex;align-items:center;gap:6px">${weatherSvg(best.id,20)} ${best.name}</span>`,"ACTIVE WEATHER · 5 MIN",best.color);
  }
  renderShell();renderBackpackPanel();bpItemPop('potion');
}
function bpUseLuckPotion(lv,all){
  const cnt=(state.luckPots&&state.luckPots[lv-1])||0;
  const n=all==='all'?cnt:1;
  const r=useLuckPotion(lv,n);
  if(!r.ok){toast("Out of potions","NO POTIONS LEFT","#f87171");return;}
  beep(560,.14,"triangle",.09);setTimeout(()=>beep(820,.14,"triangle",.08),110);
  toast("LUCK POTION L"+lv+(n>1?" ×"+n:""),"+"+r.flat+" LUCK"+(r.pct?" · +"+Math.round(r.pct*100)+"%":"")+" · "+Math.round(r.ms/60000)+" MIN","#5eead4");
  bpItemPopClose();renderShell();renderBackpackPanel();
}
function bpUseSpeedPotion(lv,all){
  const cnt=(state.speedPots&&state.speedPots[lv-1])||0;
  const n=all==='all'?cnt:1;
  const r=useSpeedPotion(lv,n);
  if(!r.ok){toast("Out of potions","NO POTIONS LEFT","#f87171");return;}
  beep(720,.14,"square",.08);setTimeout(()=>beep(980,.14,"square",.07),110);
  toast("SPEED POTION L"+lv+(n>1?" ×"+n:""),"SPEED +"+r.add.toFixed(1)+"× · "+Math.round(r.ms/60000)+" MIN","#fcd34d");
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
  if(owned<1){toast("INTAN ROLL EMPTY","NO ITEMS LEFT","#f87171");return;}
  const use=Math.min(n,owned);
  bpItemPopClose();
  let pulls=100000*use, spent=use;
  if(typeof srOn==="function"&&srOn()){
    const r=await CloudDB.spendIntan(currentUser,use);
    if(!r||!r.ok){
      const msg=!r?"KONEKSI KE SERVER PUTUS":(r.msg==="NO_INTAN"?"KREDIT INTAN SUDAH HABIS":"DITOLAK SERVER");
      toast("INTAN REJECTED BY SERVER",msg+" · TRY AGAIN","#f87171");
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
  if(owned<1){toast("OUT OF PACKS","NO ITEMS LEFT","#f87171");return;}
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
        if(spent===0){ toast("PACK REJECTED BY SERVER",msg+" · TRY AGAIN","#f87171"); renderBackpackPanel(); return; }
        toast("ROLL STOPPED BY SERVER",msg+" · "+fmt(spent)+"× ALREADY ADDED","#fcd34d");
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
    beep(200,.08,'square',.06);toast(msg,'CANNOT DO THAT','#f87171');return;
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
  return `<span class="icov"><img src="${thumbSrc(d.img)}" alt="" decoding="async" onerror="this.remove()"></span>`;
}
/* Tombol beli Backpack per kanal: raid/tower TIDAK dijual pakai coin — tombol jadi petunjuk sumber. */
function bpBuyBtn(d,kind){
  if(d.src==="raid")return `<button class="bp-shop-b off" onclick="toast('WORLD BOSS SHOP','BUY WITH WORLD BOSS TOKENS · ${fmt(d.raidCost||0)} TOKEN','#B58CFF')">WORLD BOSS SHOP · ${fmt(d.raidCost||0)} TOKEN</button>`;
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
const BP_CLOVER='<img class="bp-luckglyph" src="assets/icons/clover.svg" alt="" width="13" height="13" decoding="async">';
const BP_PLUS='<svg class="bp-eqplus" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';
const BP_LOCK='<img class="bp-tlock" src="assets/icons/padlock.svg" alt="" decoding="async">';
const BP_X='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
/* Art tile: webp asli (thumbSrc) atau SVG fallback artIconSvg — file gambar tidak disentuh. */
function bpGearArtHtml(d,cls){
  if(!d.img)return artIconSvg(d.icon);
  return `<img${cls?' class="'+cls+'"':''} src="${thumbSrc(d.img)}" alt="${d.name}" decoding="async">`;
}
/* Badge status kartu — dari state + ART_DEFS/PET_DEFS yang ada (d.src), bukan aturan baru.
   Lencana non-aktif hanya SINGKATAN kanal (TOKEN WB / DROP / GEM / COIN); kalimat kanal yang
   sebenarnya tetap milik bpBuyBtn() dan muncul utuh di modal — tidak ditulis ulang di sini. */
function bpGearStatus(d,owned,active){
  if(active)return{t:'ACTIVE',cls:'act'};
  if(owned)return{t:'OWNED',cls:'own'};
  return{t:d.src==='raid'?'TOKEN WB':d.src==='tower'?'DROP':d.src==='premium'?'GEM':'COIN',cls:'lock '+(d.src||'coin')};
}
/* Baris angka global (luck + coin) — sama seperti sebelumnya, TANPA glif shamrock. */
function bpGearCoinRow(coins){
  return `<div class="bp-coinrow">${BP_CLOVER}<b class="num">${totalLuck().toFixed(1)}×</b><span class="bp-sep" aria-hidden="true">·</span>${coinIcon(15)}<b class="num">${fmt(coins)}</b></div>`;
}
/* Slot artefak terisi = pintu LEPAS via bpArtSlot(i) — perilaku lama persis. */
function bpRelicSlotHtml(i){
  const id=state.artSlots[i],d=id?ART_DEFS.find(x=>x.id===id):null;
  if(!d)return `<button type="button" class="eqslot empty" onclick="toast('EMPTY SLOT','BUY AN ARTIFACT FIRST','#fcd34d')" aria-label="Slot ${i+1} kosong">${BP_PLUS}<span class="ek">SLOT ${i+1} KOSONG</span></button>`;
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
  const ownLine=active?(isPet?'ACTIVE PET':'EQUIPPED · SLOT '+(state.artSlots.indexOf(d.id)+1)):(owned?'OWNED':'NOT OWNED');
  const toggle="bpToggle"+(isPet?'Pet':'Art')+"('"+d.id+"')";
  const acts=active?`<button class="bp-cm-btn warn" type="button" onclick="${toggle};bpGearModalClose()">RELEASE</button>`
    :owned?`<button class="bp-cm-btn pri" type="button" onclick="${toggle};bpGearModalClose()">EQUIP</button>`
    :`<div class="bp-cm-buy">${bpBuyBtn(d,isPet?'Pet':'Art')}</div>`;
  el.setAttribute('aria-label',d.name);
  el.style.setProperty('--ec',isPet?'#7DF9FF':d.color); /* sumber sama seperti grid: artefak d.color, pet #7DF9FF (renderBpArts/renderBpPets) */
  el.innerHTML=`<div class="bp-cm-panel">
    <button class="bp-cm-x" type="button" onclick="bpGearModalClose()" aria-label="Close" title="Close [ESC]">${BP_X}</button>
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
  const map={COIN_KURANG:"NOT ENOUGH COINS",GEMS_TIDAK_CUKUP:"NOT ENOUGH GEMS",BAD_ITEM:"UNKNOWN ITEM",
             NOT_SOLD_HERE:"NOT SOLD HERE",PLAYER_NOT_FOUND:"ACCOUNT NOT SYNCED YET"};
  return map[m]||m||"SERVER TIDAK MERESPONS";
}
async function bpBuyArt(id){
  const d=ART_DEFS.find(x=>x.id===id);if(!d||state.artOwned.includes(id))return;
  if(d.src&&d.src!=="coin"){toast("NOT SOLD HERE",d.src==="raid"?"BUY IN THE WORLD BOSS SHOP WITH TOKENS":"BASE DROP IN INF TOWER","#fcd34d");return;}
  if((state.coins||0)<d.price){beep(200,.09,"square",.06);toast("NOT ENOUGH COINS","NEED ${coinIcon(15)} "+fmt(d.price),"#f87171");return;}
  /* 0028: beli lewat server — harga & saldo diperiksa di RPC buy_item, jadi
     coin hasil edit F12 ditolak di sini (bukan lagi masuk lokal lalu dibuang). */
  const online=typeof currentUser!=="undefined"&&currentUser&&window.CloudDB&&window.CloudDB.buyItem;
  if(online){
    let res=null;
    try{res=await window.CloudDB.buyItem(currentUser,id);}catch(e){res=null;}
    if(!res||!res.ok){beep(200,.09,"square",.06);toast("TRANSACTION FAILED",bpBuyErr(res),"#f87171");return;}
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
  if(i>=0){state.artSlots[i]=null;beep(360,.08,"triangle",.06);toast("UNEQUIPPED",d.name,"#9ca3af");}
  else{let s=state.artSlots.indexOf(null);if(s<0)s=0;state.artSlots[s]=id;beep(680,.12,"triangle",.09);toast("EQUIPPED",d.name+" → SLOT "+(s+1),d.color);}
  save();renderShell();renderBackpackPanel();
  if(!battleLive()&&typeof render==="function")render();
}
function bpArtSlot(i){const id=state.artSlots[i];if(id)bpToggleArt(id);}
async function bpBuyPet(id){
  const d=PET_DEFS.find(x=>x.id===id);if(!d||state.petOwned.includes(id))return;
  if(d.src&&d.src!=="coin"){toast("NOT SOLD HERE",d.src==="raid"?"BUY IN THE WORLD BOSS SHOP WITH TOKENS":"BASE DROP IN INF TOWER","#fcd34d");return;}
  if((state.coins||0)<d.price){beep(200,.09,"square",.06);toast("NOT ENOUGH COINS","NEED ${coinIcon(15)} "+fmt(d.price),"#f87171");return;}
  /* 0028: idem bpBuyArt — pembelian coin divalidasi server. */
  const online=typeof currentUser!=="undefined"&&currentUser&&window.CloudDB&&window.CloudDB.buyItem;
  if(online){
    let res=null;
    try{res=await window.CloudDB.buyItem(currentUser,id);}catch(e){res=null;}
    if(!res||!res.ok){beep(200,.09,"square",.06);toast("TRANSACTION FAILED",bpBuyErr(res),"#f87171");return;}
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
  if(state.petEquipped===id){state.petEquipped=null;beep(360,.08,"triangle",.06);toast("PET UNEQUIPPED",d.name,"#9ca3af");}
  else{state.petEquipped=id;beep(680,.12,"triangle",.09);toast("PET ACTIVE",d.name+" · "+luckTxt(d),d.color);}
  save();renderShell();renderBackpackPanel();
  if(!battleLive()&&typeof render==="function")render();
}
function lobbyPetHtml(){
  const d=state&&state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;
  if(!d)return"";
  return `<div class="lobby-pet"><img src="${thumbSrc(d.img)}" alt="${d.name}" decoding="async" onerror="this.parentNode.classList.add('noimg')"><span class="lp-eb">${d.emoji}</span><span class="lp-tip"><b style="color:${d.color}">${d.name}</b><small>${luckTxt(d)}</small></span></div>`;
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

/* =============== PREMIUM EXCHANGE (port _tmp/proto_premium_shop_v1.html) ===============
   Markup: #premiumModal.psx-modal (index.html) — dua panel katalog + detail.
   CSS: css/premium-exchange.css. Banner masuk/keluar = #premiumCurtain (pola
   Backpack, hanya nama banner yang diganti). Semua teks English. */
var premCurTab = 'all';
var pxSelId = 'global_luck';
var pxQty = 1;

var PREMIUM_PACKS = [
  { id: 'global_luck', cat: 'event', type: 'global_luck', name: 'GLOBAL LUCK x10', price: 1200, img: 'assets/images/global-luck.webp?v=1', badge: 'SERVER EVENT', tier: 'WORLD BUFF', color: '#34d399', stats: ['10x SERVER LUCK', '60 MINUTES', 'MAX 100x'], desc: 'Activate 10x LUCK for every player on the server for 1 HOUR. Your username is shown as the activator.' },
  // PASSES (sumber tunggal dari PASS_DEFS di data.js)
  ...((typeof PASS_DEFS !== 'undefined' ? PASS_DEFS : []).map(function(p){
    return { id: p.id, cat: 'pass', type: 'pass', name: p.name, price: p.gemPrice, img: p.img, badge: p.badge, tier: p.tier, color: p.color, stats: p.stats, desc: p.desc, effectHtml: p.effectHtml };
  })),
  // LOADOUT
  { id: 'tome-infinity', cat: 'equip', type: 'art', name: 'TOME OF INFINITY', price: 3000, img: 'assets/artifacts/tome-infinity.webp?v=1', badge: 'MYTHIC ARTIFACT', tier: 'ARTIFACT', color: '#38bdf8', stats: ['+150 FLAT LUCK', '+200% LUCK', 'PERMANENT'], desc: 'Unlimited mystic tome. Grants +150 Flat Luck and +200% Luck permanently once equipped.' },
  { id: 'cyber-kitsune', cat: 'equip', type: 'pet', name: 'CYBER KITSUNE', price: 10000, img: 'assets/pets/cyber-kitsune.webp?v=1', badge: 'SUPREME PET', tier: 'PET', color: '#f43f5e', stats: ['+250 FLAT LUCK', '+300% LUCK', 'SUPREME TIER'], desc: 'Legendary future fox. Grants +250 Flat Luck and +300% Luck while equipped as your companion.' },

  // INSTANT ROLL PACKS
  { id: 'r5k', cat: 'pack', type: 'pack', name: 'INSTANT ROLL 5,000', amount: 5000, price: 25, img: 'assets/images/instanpack-5k.webp?v=trans1', badge: 'STARTER PACK', tier: 'PACK', color: '#38bdf8', stats: ['5,000 PULLS', 'INSTANT LOOT', 'MULTI-BUY'], desc: '5,000 instant card pulls delivered straight into your Backpack inventory.' },
  { id: 'r10k', cat: 'pack', type: 'pack', name: 'INSTANT ROLL 10,000', amount: 10000, price: 50, img: 'assets/images/instanpack-10k.webp?v=trans1', badge: 'POPULAR PACK', tier: 'PACK', color: '#2dd4bf', stats: ['10,000 PULLS', 'INSTANT LOOT', 'MULTI-BUY'], desc: '10,000 instant card pulls delivered straight into your Backpack inventory.' },
  { id: 'r25k', cat: 'pack', type: 'pack', name: 'INSTANT ROLL 25,000', amount: 25000, price: 100, img: 'assets/images/instanpack-25k.webp?v=trans1', badge: 'VALUE PACK', tier: 'PACK', color: '#a855f7', stats: ['25,000 PULLS', 'BEST VALUE', 'MULTI-BUY'], desc: '25,000 instant card pulls delivered straight into your Backpack inventory.' },
  { id: 'r50k', cat: 'pack', type: 'pack', name: 'INSTANT ROLL 50,000', amount: 50000, price: 150, img: 'assets/images/instanpack-50k.webp?v=trans1', badge: 'EPIC PACK', tier: 'PACK', color: '#f59e0b', stats: ['50,000 PULLS', 'HIGH YIELD', 'MULTI-BUY'], desc: '50,000 instant card pulls delivered straight into your Backpack inventory.' },
  { id: 'r100k', cat: 'pack', type: 'pack', name: 'INSTANT ROLL 100,000', amount: 100000, price: 250, img: 'assets/images/instanpack-100k.webp?v=trans1', badge: 'ULTIMATE PACK', tier: 'PACK', color: '#ec4899', stats: ['100,000 PULLS', 'MAX OVERDRIVE', 'MULTI-BUY'], desc: '100,000 instant card pulls delivered straight into your Backpack inventory.' },

  // WEATHER ANOMALY (rare .. awakened only)
  { id: 'w_eclipse', cat: 'weather', type: 'weather', targetWeather: 'eclipse', name: 'INSTANT ECLIPSE', price: 150, img: 'assets/images/weather-eclipse.webp?v=1', badge: 'RARE WEATHER', tier: 'ECLIPSE', color: '#c4b5fd', stats: ['+300% LUCK', '+200% SPEED', '30 MINUTES'], desc: 'Summon the ECLIPSE anomaly server-wide for 30 minutes. +300% Luck, +200% roll speed.' },
  { id: 'w_doodle', cat: 'weather', type: 'weather', targetWeather: 'doodle', name: 'INSTANT DOODLE', price: 200, img: 'assets/images/weather-doodle.webp?v=1', badge: 'RARE WEATHER', tier: 'DOODLE', color: '#f1f5f9', stats: ['+400% LUCK', '+250% SPEED', '30 MINUTES'], desc: 'Summon the DOODLE anomaly server-wide for 30 minutes. +400% Luck, +250% roll speed.' },
  { id: 'w_glitch', cat: 'weather', type: 'weather', targetWeather: 'glitch', name: 'INSTANT GLITCH', price: 300, img: 'assets/images/weather-glitch.webp?v=1', badge: 'RARE WEATHER', tier: 'GLITCH', color: '#f87171', stats: ['+500% LUCK', '+300% SPEED', '30 MINUTES'], desc: 'Summon the GLITCH anomaly server-wide for 30 minutes. +500% Luck, +300% roll speed.' },
  { id: 'w_goofy', cat: 'weather', type: 'weather', targetWeather: 'goofy', name: 'INSTANT GOOFY', price: 450, img: 'assets/images/weather-goofy.webp?v=1', badge: 'RARE WEATHER', tier: 'GOOFY', color: '#fde047', stats: ['+600% LUCK', '+350% SPEED', '30 MINUTES'], desc: 'Summon the GOOFY anomaly server-wide for 30 minutes. +600% Luck, +350% roll speed.' },
  { id: 'w_arcane', cat: 'weather', type: 'weather', targetWeather: 'arcane', name: 'INSTANT ARCANE', price: 750, img: 'assets/images/weather-arcane.webp?v=1', badge: 'ARCANE WEATHER', tier: 'ARCANE', color: '#a78bfa', stats: ['+900% LUCK', '+500% SPEED', '30 MINUTES'], desc: 'Summon the ARCANE magic anomaly server-wide for 30 minutes. +900% Luck, +500% roll speed.' },
  { id: 'w_awakened', cat: 'weather', type: 'weather', targetWeather: 'awakened', name: 'INSTANT AWAKENED', price: 1500, img: 'assets/images/weather-awakened.webp?v=1', badge: 'SUPREME AWAKENED', tier: 'AWAKENED', color: '#c084fc', stats: ['+1400% LUCK', '+700% SPEED', '30 MINUTES'], desc: 'Unleash the highest power on the server for 30 minutes. +1400% Luck, +700% roll speed.' }
];

var PX_GROUPS = [
  { key: 'event',   label: 'SERVER EVENT',    note: 'WORLD BUFF' },
  { key: 'pass',    label: 'BATTLE PASSES',   note: 'PERMANENT · STACKS ALL' },
  { key: 'pack',    label: 'INSTANT ROLL',    note: 'BACKPACK' },
  { key: 'equip',   label: 'LOADOUT',         note: 'PERMANENT' },
  { key: 'weather', label: 'WEATHER ANOMALY', note: '30 MIN' }
];
var PX_QTY_LIST = [1, 5, 10, 25];

function pxEsc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]); }); }
function pxNum(n){ return (n == null ? '0' : Number(n).toLocaleString('en-US')); }
function pxItems(){ return (typeof PREMIUM_PACKS !== 'undefined') ? PREMIUM_PACKS : []; }
function pxFiltered(){
  var items = pxItems();
  if (premCurTab === 'all') return items.slice();
  return items.filter(function(i){ return i.cat === premCurTab; });
}
function pxSelItem(){
  var items = pxItems();
  return items.find(function(i){ return i.id === pxSelId; }) || pxFiltered()[0] || items[0];
}
function pxPullsPerGem(it){ return (it.type === 'pack' && it.price) ? Math.round(it.amount / it.price) : 0; }
function pxGlobalLuckState(){
  var gl = (typeof _globalLuckCache !== 'undefined' && _globalLuckCache) ? _globalLuckCache : null;
  var active = !!(gl && gl.ends_at && Date.now() < new Date(gl.ends_at).getTime());
  var maxed = active && (gl.multiplier || 10) >= (typeof GLOBAL_LUCK_MAX_MULT !== 'undefined' ? GLOBAL_LUCK_MAX_MULT : 100);
  return { gl: gl, active: active, maxed: maxed };
}
function pxOwnedInfo(it){
  if (it.type === 'global_luck') {
    var s = pxGlobalLuckState();
    return { owned: s.maxed, active: s.active, gl: s.gl };
  }
  if (it.type === 'art') return { owned: (state.artOwned || []).includes(it.id) };
  if (it.type === 'pet') return { owned: (state.petOwned || []).includes(it.id) };
  if (it.type === 'pass') return { owned: Array.isArray(state.passesOwned) && state.passesOwned.includes(it.id) };
  if (it.type === 'weather') {
    var cur = (typeof activeWeatherId === 'function') ? activeWeatherId() : null;
    return { owned: false, active: cur === it.targetWeather };
  }
  return { owned: false, stock: (state.rollPacks && state.rollPacks[it.id]) || 0 };
}

/* ---- Purchase confirmation popup body (English) ---- */
function premConfirmBody(pack, qty) {
  qty = Math.max(1, parseInt(qty, 10) || 1);
  var gemIcon = '<img class="glcf-gem-icon" src="assets/images/premium-currency.webp" alt="" width="16" height="16">';
  var effect = pack.desc || '';
  var effectLabel = 'EFFECT';
  if (pack.type === 'pack') {
    var totalPull = Number(pack.amount || 0) * qty;
    effect = '<b>' + totalPull.toLocaleString('en-US') + '</b> instant card pulls into your Backpack.';
  } else if (pack.type === 'art') {
    effect = 'Permanent artifact added to your Backpack.';
  } else if (pack.type === 'pet') {
    effect = 'Permanent pet added to your Backpack.';
  } else if (pack.type === 'pass') {
    var pDef = typeof passDef === 'function' ? passDef(pack.id) : null;
    effect = (pack.effectHtml || pxEsc(pack.desc || 'Unlocked permanently on your account.'));
    if (pDef && pDef.kind === 'luck' && typeof passLuckMult === 'function') {
      var curLk = passLuckMult(), nextLk = curLk * (pDef.luckMult || 1);
      effect += ' <b>(Pass Luck: ' + curLk + '× → ' + nextLk + '×)</b>';
    } else if (pDef && pDef.kind === 'shiny' && typeof passShinyMult === 'function') {
      var curSh = passShinyMult(), nextSh = curSh * (pDef.shinyMult || 1);
      effect += ' <b>(Pass Shiny: ' + curSh + '× → ' + nextSh + '×)</b>';
    }
  } else if (pack.type === 'weather') {
    var wName = (WEATHER[pack.targetWeather] && WEATHER[pack.targetWeather].name) || pack.name;
    effectLabel = 'SERVER WEATHER';
    effect = '<b>' + wName + '</b> active for ALL players for 30 minutes.';
  }
  var totalPrice = Number(pack.price || 0) * qty;
  return '<div class="glcf-row"><span class="glcf-label">ITEM</span><span class="glcf-val"><b>' + pack.name + '</b>' +
      (pack.badge ? '<span class="glcf-badge">' + pack.badge + '</span>' : '') + '</span></div>' +
    '<div class="glcf-row"><span class="glcf-label">' + effectLabel + '</span><span class="glcf-val">' + effect + '</span></div>' +
    '<div class="glcf-row"><span class="glcf-label">PRICE</span><span class="glcf-val">' + gemIcon + ' ' + totalPrice.toLocaleString('en-US') + ' Gems</span></div>' +
    '<div class="glcf-row"><span class="glcf-label">BALANCE</span><span class="glcf-val">' + gemIcon + ' ' + fmt(state.premiumGems || 0) + ' Gems</span></div>' +
    '<div class="glcf-warn">Charged immediately, <b>cannot be refunded</b>.</div>';
}

/* ---- Banner hazard masuk/keluar (#premiumCurtain, pola Backpack) ---- */
var _pxT = [];
function pxClearT(){ for (var i = 0; i < _pxT.length; i++) clearTimeout(_pxT[i]); _pxT = []; }
function pxSetCopy(mode){
  var kick = document.getElementById('pxHZKick'), title = document.getElementById('pxHZTitle'),
      sub = document.getElementById('pxHZSub'), foot = document.getElementById('pxHZFoot'),
      serial = document.getElementById('pxHZSerial'), water = document.getElementById('pxHZWater');
  if (serial) serial.textContent = (0x1000 + Math.floor(Math.random() * 0xefff)).toString(16).toUpperCase();
  if (mode === 'open') {
    if (kick) kick.innerHTML = '// MARKET <b>UPLINK</b>';
    if (title) title.textContent = 'PREMIUM';
    if (water) water.textContent = 'SHOP';
    if (sub) sub.textContent = 'BLACK-MARKET EXCHANGE · GEMS · PACKS · RELICS';
    if (foot) foot.textContent = 'SYNC MARKET';
  } else {
    if (kick) kick.innerHTML = '// LINK <b>STAND BY</b>';
    if (title) title.textContent = 'CLOSING';
    if (water) water.textContent = 'EXIT';
    if (sub) sub.textContent = 'EXCHANGE DISCONNECTING · BALANCE SAVED';
    if (foot) foot.textContent = 'CLOSE SESSION';
  }
}
function pxBannerOpen(){
  var c = document.getElementById('premiumCurtain');
  if (!c) return;
  pxClearT(); pxSetCopy('open');
  c.className = ''; void c.offsetWidth;
  c.classList.add('on', 'smooth', 'sweep');
  _pxT.push(setTimeout(function(){ c.classList.add('revealed'); }, 1080));
  _pxT.push(setTimeout(function(){ c.classList.remove('on', 'smooth', 'sweep', 'revealed'); }, 1800));
}
/* EXIT 3 fase: tirai MENUTUP -> konten disembunyikan -> tirai MEMBUKA.
   Fase 3 wajib; tanpanya layar tertahan tertutup ("banner tidak kebuka"). */
function pxBannerClose(onCovered){
  var c = document.getElementById('premiumCurtain');
  if (!c) { if (onCovered) onCovered(); return; }
  pxClearT(); pxSetCopy('close');
  c.className = ''; c.classList.add('on', 'smooth', 'revealed'); void c.offsetWidth;
  c.classList.remove('revealed');
  _pxT.push(setTimeout(function(){ if (onCovered) onCovered(); }, 560));
  _pxT.push(setTimeout(function(){ c.classList.add('revealed'); }, 780));
  _pxT.push(setTimeout(function(){ c.classList.remove('on', 'smooth', 'revealed'); }, 1560));
}
window.pxBannerOpen = pxBannerOpen;
window.pxBannerClose = pxBannerClose;

/* ---- Selectors ---- */
function pxList() { return document.getElementById('psxList'); }
function pxChoose(id) {
  pxSelId = id;
  var it = pxSelItem();
  if (!it || it.type !== 'pack') pxQty = 1;
  renderPremiumShop();
  var shell = document.getElementById('psxShell');
  if (shell) shell.classList.add('detail-open');
}
function pxChooseQty(q) {
  pxQty = Math.max(1, parseInt(q, 10) || 1);
  renderPremiumShop();
}
function pxBack() {
  var shell = document.getElementById('psxShell');
  if (shell) shell.classList.remove('detail-open');
}
function premSetTab(tabKey){
  premCurTab = tabKey || 'all';
  var tabs = document.querySelectorAll('#psxTabs .psx-tab');
  tabs.forEach(function(b){
    if (b.getAttribute('data-cat') === premCurTab) b.classList.add('on');
    else b.classList.remove('on');
  });
  var items = pxFiltered();
  if (!items.some(function(i){ return i.id === pxSelId; }) && items.length) {
    pxSelId = items[0].id;
    pxQty = 1;
  }
  renderPremiumShop();
  pxBack();
}

/* ---- Open / close ---- */
function openPremiumShop(focusId){
  var hasFocus = !!(focusId && pxItems().some(function(i){ return i.id === focusId; }));
  if (hasFocus) {
    premCurTab = 'all';
    pxSelId = focusId;
    pxQty = 1;
  }
  pxBack();
  renderPremiumShop();
  if (hasFocus) {
    var shell = document.getElementById('psxShell');
    if (shell) shell.classList.add('detail-open');
    document.querySelectorAll('#psxTabs .psx-tab').forEach(function(b){
      if (b.getAttribute('data-cat') === premCurTab) b.classList.add('on');
      else b.classList.remove('on');
    });
  }
  var modal = document.getElementById('premiumModal');
  if (modal) modal.classList.add('show');
  document.body.classList.add('hide-docks-modal');
  var closeBtn = document.getElementById('premClose');
  if (closeBtn) closeBtn.onclick = closePremiumShop;
  if (modal) modal.onclick = function(e){ if (e.target.id === 'premiumModal') closePremiumShop(); };
  var backBtn = document.getElementById('psxBack');
  if (backBtn) backBtn.onclick = pxBack;
  bindPsxEvents();
  pxBannerOpen();
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
      if (Array.isArray(sd.passesOwned)) {
        state.passesOwned = state.passesOwned || [];
        sd.passesOwned.forEach(function(id){
          var okId = (typeof passDef === 'function') ? !!passDef(id) : (id === 'speed-3x');
          if (okId && !state.passesOwned.includes(id)) { state.passesOwned.push(id); changed = true; }
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
  var doHide = function(){
    var modal = document.getElementById('premiumModal');
    if (modal) modal.classList.remove('show');
    document.body.classList.remove('hide-docks-modal');
    var shell = document.getElementById('psxShell');
    if (shell) shell.classList.remove('detail-open');
  };
  if (typeof window.pxBannerClose === 'function') { try { window.pxBannerClose(doHide); } catch (e) { doHide(); } }
  else doHide();
}

/* ---- Catalog row ---- */
function pxRowHtml(it){
  var on = it.id === pxSelId;
  var owned = pxOwnedInfo(it).owned;
  var hot = /STARTER|POPULAR|BEST|ULTIMATE|BATTLE PASS|LUCK PASS|LUCK BOOSTER|SHINY PASS|SHINY BOOSTER/.test(it.badge || '');
  var isCard = (it.type === 'pack' || it.type === 'art' || it.type === 'pet');
  return '<button class="psx-row' + (on ? ' on' : '') + (owned ? ' dim' : '') + '" type="button" data-id="' + it.id + '" style="--ic:' + (it.color || '#f3e600') + '">' +
    '<span class="psx-row-art' + (isCard ? ' card' : '') + '">' +
      '<i class="halo"></i>' +
      '<img src="' + it.img + '" alt="" decoding="async">' +
    '</span>' +
    '<span class="psx-row-mid">' +
      '<span class="psx-row-cat">' + pxEsc(String(it.cat).toUpperCase()) + ' · ' + pxEsc(it.tier || it.type.toUpperCase()) + '</span>' +
      '<span class="psx-row-nm" title="' + pxEsc(it.name) + '">' + pxEsc(it.name) + '</span>' +
      '<span class="psx-row-tag' + (hot ? ' hot' : '') + '">' + (owned ? 'OWNED' : pxEsc(it.badge || '')) + '</span>' +
    '</span>' +
    '<span class="psx-row-price"><b>' + pxNum(it.price) + '<i>G</i></b><span>GEMS</span></span>' +
  '</button>';
}

function pxRenderCatalog(){
  var list = pxList();
  if (!list) return;
  var items = pxFiltered();
  var groups = PX_GROUPS.map(function(g){
    return { g: g, rows: items.filter(function(i){ return i.cat === g.key; }) };
  }).filter(function(x){ return x.rows.length; });

  list.innerHTML = groups.map(function(x){
    var gNote = x.g.note;
    if (x.g.key === 'pass' && typeof passLuckMult === 'function' && typeof passShinyMult === 'function') {
      var pl = passLuckMult(), ps = passShinyMult();
      if (pl > 1 || ps > 1) {
        gNote = 'STACK: ' + pl + '× LK · ' + ps + '× SHINY';
      }
    }
    return '<div class="psx-grp">' +
      '<div class="psx-grp-h"><b>' + pxEsc(x.g.label) + '</b><i></i><span>' + x.rows.length + ' · ' + pxEsc(gNote) + '</span></div>' +
      x.rows.map(pxRowHtml).join('') +
    '</div>';
  }).join('') || '<div class="psx-grp-h" style="margin:12px 6px">NO ITEMS IN THIS CATEGORY</div>';

  var catCount = document.getElementById('psxCatCount');
  if (catCount) catCount.textContent = items.length + ' ITEMS';
  var footCount = document.getElementById('psxFootCount');
  if (footCount) footCount.textContent = pxItems().length + ' ITEMS';

  var all = pxItems();
  var counts = { all: all.length, pass: 0, pack: 0, weather: 0, equip: 0, event: 0 };
  all.forEach(function(i){ if (counts[i.cat] !== undefined) counts[i.cat]++; });
  var map = { psxCntAll: counts.all, psxCntPass: counts.pass, psxCntPack: counts.pack, psxCntWeather: counts.weather, psxCntEquip: counts.equip, psxCntEvent: counts.event };
  Object.keys(map).forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.textContent = map[id];
  });
}

/* ---- Detail: qty option ---- */
function pxOptHtml(it, q){
  var isOn = pxQty === q;
  var total = it.price * q;
  var tag = q === 25 ? 'BEST DEAL' : (q === 10 ? 'VALUE' : (q === 5 ? 'POPULAR' : 'STARTER'));
  return '<button class="psx-opt' + (isOn ? ' on' : '') + '" type="button" data-q="' + q + '">' +
    '<span class="tag' + (isOn || q === 25 ? ' hot' : '') + '">' + (isOn ? 'SELECTED' : tag) + '</span>' +
    '<span class="psx-opt-art"><img src="' + it.img + '" alt="" decoding="async"></span>' +
    '<span class="psx-opt-q">x' + q + '</span>' +
    '<span class="psx-opt-lbl">' + pxNum(it.amount * q) + ' PULLS</span>' +
    '<span class="psx-opt-price"><img src="assets/images/premium-currency.webp" alt="Gem" width="10" height="10">' + pxNum(total) + '</span>' +
  '</button>';
}

function pxRenderDetail(){
  var body = document.getElementById('psxDetailBody');
  if (!body) return;
  var it = pxSelItem();
  if (!it) { body.innerHTML = ''; return; }

  var info = pxOwnedInfo(it);
  var owned = !!info.owned;
  var isPack = it.type === 'pack';
  var qty = isPack ? pxQty : 1;
  var total = it.price * qty;
  var gemsNow = (state && state.premiumGems) || 0;

  var chips = [
    owned ? '<span class="psx-chip owned">OWNED</span>' : '<span class="psx-chip solid">' + pxEsc(it.badge || '') + '</span>',
    it.type === 'weather' ? '<span class="psx-chip">SERVER-WIDE</span>' : '<span class="psx-chip">DELIVERED INSTANTLY</span>',
    isPack ? '<span class="psx-chip">x' + qty + ' PURCHASE</span>'
      : (it.type === 'global_luck' ? '<span class="psx-chip">60 MINUTES</span>' : '<span class="psx-chip">PERMANENT</span>')
  ].join('');

  var statLabels = ['PRIMARY', 'SECONDARY', 'DURATION'];
  var stats = (it.stats || []).map(function(s, i){
    return '<div class="psx-stat"><k>' + (statLabels[i] || 'DETAIL') + '</k><v>' + pxEsc(s) + '</v></div>';
  }).join('');

  var picker;
  if (isPack) {
    picker =
      '<div class="psx-sec-h"><b>PICK A PACK</b><i></i><span>' + pxNum(it.amount) + ' PULLS EACH</span></div>' +
      '<div class="psx-qty" id="psxQtyWrap">' + PX_QTY_LIST.map(function(q){ return pxOptHtml(it, q); }).join('') + '</div>' +
      '<div class="psx-value">' +
        '<div class="psx-value-h">VALUE · <b>' + pxNum(pxPullsPerGem(it)) + ' PULLS / GEM</b><i></i><span>PACK EFFICIENCY</span></div>' +
        '<div class="psx-value-track"><div class="psx-value-fill" style="width:' + Math.min(100, Math.round(pxPullsPerGem(it) / 400 * 100)) + '%"></div></div>' +
      '</div>' +
      '<div class="psx-order">' +
        '<div class="psx-order-h"><b>ORDER SUMMARY</b><i></i><span>SERVER VERIFIED</span></div>' +
        '<div class="psx-order-row"><span>UNIT PRICE</span><b>' + pxNum(it.price) + ' G</b></div>' +
        '<div class="psx-order-row"><span>QUANTITY</span><b>x' + qty + '</b></div>' +
        '<div class="psx-order-row"><span>TOTAL PULLS</span><b>' + pxNum(it.amount * qty) + '</b></div>' +
        '<div class="psx-order-row tot"><span>TOTAL COST</span><b>' + pxNum(total) + ' G</b></div>' +
        '<div class="psx-order-row after"><span>BALANCE AFTER</span><b>' + pxNum(Math.max(0, gemsNow - total)) + ' G</b></div>' +
      '</div>';
  } else {
    var pMeta = (it.type === 'pass' && typeof passDef === 'function') ? passDef(it.id) : null;
    var singleTitle = it.type === 'weather' ? 'Delivered to the live server'
      : (it.type === 'global_luck' ? 'Activates instantly for everyone'
      : (it.type === 'pass' ? 'Unlocked permanently · Stackable' : 'Added to your Backpack'));
    var singleSub = it.type === 'weather' ? 'ALL PLAYERS · 30 MINUTES'
      : (it.type === 'global_luck' ? 'SERVER-WIDE · 60 MINUTES'
      : (pMeta && pMeta.kind === 'luck' && typeof passLuckMult === 'function' ? ('ACTIVE PASS LUCK: ' + passLuckMult() + '× · NO CAP')
      : (pMeta && pMeta.kind === 'shiny' && typeof passShinyMult === 'function' ? ('ACTIVE PASS SHINY: ' + passShinyMult() + '× · NO CAP')
      : 'PERMANENT · ACCOUNT BOUND · STACKS ALL')));
    picker =
      '<div class="psx-sec-h"><b>SINGLE PURCHASE</b><i></i><span>1 ITEM</span></div>' +
      '<div class="psx-single">' +
        '<span class="psx-single-ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>' +
        '<span class="psx-single-tx"><b>' + singleTitle + '</b><span>' + singleSub + '</span></span>' +
      '</div>' +
      '<div class="psx-order">' +
        '<div class="psx-order-h"><b>ORDER SUMMARY</b><i></i><span>SERVER VERIFIED</span></div>' +
        '<div class="psx-order-row"><span>UNIT PRICE</span><b>' + pxNum(it.price) + ' G</b></div>' +
        '<div class="psx-order-row"><span>QUANTITY</span><b>x1</b></div>' +
        '<div class="psx-order-row"><span>DELIVERY</span><b>INSTANT</b></div>' +
        '<div class="psx-order-row tot"><span>TOTAL COST</span><b>' + pxNum(total) + ' G</b></div>' +
        '<div class="psx-order-row after"><span>BALANCE AFTER</span><b>' + pxNum(Math.max(0, gemsNow - total)) + ' G</b></div>' +
      '</div>';
  }

  var isCard = (isPack || it.type === 'art' || it.type === 'pet');
  body.innerHTML =
    '<div class="psx-d-body">' +
      '<div class="psx-d-left">' +
        '<div class="psx-hero">' +
          '<div class="psx-hero-art' + (isCard ? ' card' : '') + '" style="--ic:' + (it.color || '#f3e600') + '">' +
            '<i class="halo"></i>' +
            '<img src="' + it.img + '" alt="' + pxEsc(it.name) + '" decoding="async">' +
          '</div>' +
          '<div class="psx-hero-mid">' +
            '<div class="psx-hero-nm">' + pxEsc(it.name) + '</div>' +
            '<div class="psx-chips">' + chips + '</div>' +
            '<div class="psx-hero-ds">' + pxEsc(it.desc) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="psx-stats">' + stats + '</div>' +
      '</div>' +
      '<div class="psx-d-right">' + picker + '</div>' +
    '</div>';

  var wrap = document.getElementById('psxQtyWrap');
  if (wrap) {
    wrap.querySelectorAll('.psx-opt').forEach(function(b){
      b.onclick = function(){ pxChooseQty(b.dataset.q); };
    });
  }

  var totalK = document.getElementById('psxTotalK');
  if (totalK) totalK.textContent = isPack ? ('TOTAL · x' + qty) : 'TOTAL';
  var totalVal = document.getElementById('psxTotalVal');
  if (totalVal) totalVal.textContent = pxNum(total);

  var btn = document.getElementById('psxBuyBtn');
  var txt = document.getElementById('psxBuyTxt');
  if (btn && txt) {
    var afford = gemsNow >= total;
    var glState = pxGlobalLuckState();
    if (owned) {
      btn.className = 'psx-buy is-own';
      txt.textContent = it.type === 'global_luck' ? 'MAX STACK REACHED' : 'ALREADY OWNED';
      btn.disabled = true;
    } else if (!afford) {
      btn.className = 'psx-buy is-off';
      txt.textContent = 'NEED ' + pxNum(total - gemsNow) + ' MORE';
      btn.disabled = true;
    } else {
      btn.className = 'psx-buy';
      txt.textContent = (it.type === 'global_luck')
        ? ((glState.active ? 'STACK +10x · ' : 'ACTIVATE · ') + pxNum(total) + ' GEMS')
        : ('BUY · ' + pxNum(total) + ' GEMS');
      btn.disabled = false;
    }
  }

  var balEl = document.getElementById('premBalVal');
  if (balEl) balEl.textContent = pxNum(gemsNow);
}

function renderPremiumShop(){
  if (!document.getElementById('psxList')) return;
  if (typeof state === 'undefined' || !state) return;
  pxRenderCatalog();
  pxRenderDetail();
}

/* ---- Event binding (idempotent: pakai onclick agar tak menumpuk) ---- */
function bindPsxEvents(){
  var list = pxList();
  if (list) {
    list.onclick = function(e){
      var row = e.target.closest ? e.target.closest('.psx-row') : null;
      if (!row) return;
      pxChoose(row.getAttribute('data-id'));
    };
  }
  var tabs = document.getElementById('psxTabs');
  if (tabs) {
    tabs.onclick = function(e){
      var b = e.target.closest ? e.target.closest('.psx-tab') : null;
      if (!b) return;
      premSetTab(b.getAttribute('data-cat'));
    };
  }
  var backBtn = document.getElementById('psxBack');
  if (backBtn) backBtn.onclick = pxBack;
  var buyBtn = document.getElementById('psxBuyBtn');
  if (buyBtn) {
    buyBtn.onclick = function(e){
      var it = pxSelItem();
      if (!it) return;
      if (pxOwnedInfo(it).owned) return;
      buyPremiumPack(it.id, e, it.type === 'pack' ? pxQty : 1);
    };
  }
}

async function buyPremiumPack(packId, ev, qty){
  var pack = PREMIUM_PACKS.find(function(x){ return x.id === packId; });
  if(!pack) return;

  // Check unique artifact/pet/pass ownership
  if(pack.type === 'art' && (state.artOwned || []).includes(pack.id)){
    toast('ALREADY OWNED', 'Artifact ' + pack.name + ' is already in your Backpack!', '#fcd34d');
    return;
  }
  if(pack.type === 'pet' && (state.petOwned || []).includes(pack.id)){
    toast('ALREADY OWNED', 'Pet ' + pack.name + ' is already in your Backpack!', '#fcd34d');
    return;
  }
  if(pack.type === 'pass' && Array.isArray(state.passesOwned) && state.passesOwned.includes(pack.id)){
    toast('ALREADY OWNED', pack.name + ' is already unlocked on your account!', '#fcd34d');
    return;
  }

  var btn = (ev && ev.currentTarget) || (window.event && window.event.currentTarget);
  var buyTxt = document.getElementById('psxBuyTxt');

  // global_luck — delegate to buyGlobalLuck() (its own confirmation popup)
  if (pack.type === 'global_luck') {
    await buyGlobalLuck();
    if(btn) btn.disabled = false;
    return;
  }

  /* --- Purchase confirmation (hazard dialog, qty switchable for packs) --- */
  qty = Math.max(1, parseInt(qty, 10) || 1);
  var cfOpts = pack.type === 'pack'
    ? PX_QTY_LIST.map(function (q) {
        return {
          label: 'x' + q,
          value: String(q),
          body: premConfirmBody(pack, q),
          okText: 'BUY · ' + (Number(pack.price) * q).toLocaleString('en-US') + ' GEMS',
          total: (Number(pack.price) * q).toLocaleString('en-US'),
          totalLabel: 'TOTAL · x' + q
        };
      })
    : [];
  var cfBase = Number(pack.price) * qty;
  var confirmed = await showConfirmDialog({
    variant: 'hazard',
    title: pack.type === 'pack' ? 'QUANTITY SELECT' : 'PURCHASE CONFIRMATION',
    img: pack.img || 'assets/images/premium-currency.webp',
    body: premConfirmBody(pack, qty),
    okText: 'BUY · ' + cfBase.toLocaleString('en-US') + ' GEMS',
    totalLabel: 'TOTAL · x' + qty,
    totalValue: cfBase.toLocaleString('en-US'),
    options: cfOpts,
    selected: cfOpts.length ? String(PX_QTY_LIST.indexOf(qty) >= 0 ? qty : 1) : undefined
  });
  if (!confirmed) {
    toast('CANCELLED', 'Purchase cancelled', '#94a3b8');
    return;
  }
  if (pack.type === 'pack') {
    var pickedQty = parseInt(confirmed, 10);
    if (pickedQty > 0) qty = pickedQty;
    pxQty = qty;
  }

  var totalCost = Number(pack.price || 0) * qty;
  if(btn) btn.disabled = true;
  if(buyTxt) buyTxt.textContent = 'PROCESSING...';

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
        toast('TRANSACTION FAILED', res.msg || 'Insufficient balance!', '#f87171');
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
      } else if(pack.type === 'pass'){
        if (Array.isArray(res.passesOwned)) state.passesOwned = res.passesOwned;
        else {
          state.passesOwned = state.passesOwned || [];
          if(!state.passesOwned.includes(pack.id)) state.passesOwned.push(pack.id);
        }
        var pMetaSrv = typeof passDef === 'function' ? passDef(pack.id) : null;
        if((pMetaSrv && pMetaSrv.maxSpeed) || pack.id === 'speed-3x'){
          state.battleSpeed = (pMetaSrv && pMetaSrv.maxSpeed) || 3;
          if(typeof bt !== 'undefined' && bt) bt.speed = battleSpeedEff();
        }
        if(typeof srReset === 'function') srReset();
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
        toast('NOT ENOUGH GEMS', 'You need ' + totalCost + ' Gems to buy this!', '#f87171');
        return;
      }
      state.premiumGems -= totalCost;
      if(pack.type === 'art'){
        state.artOwned = state.artOwned || [];
        if(!state.artOwned.includes(pack.id)) state.artOwned.push(pack.id);
      } else if(pack.type === 'pet'){
        state.petOwned = state.petOwned || [];
        if(!state.petOwned.includes(pack.id)) state.petOwned.push(pack.id);
      } else if(pack.type === 'pass'){
        state.passesOwned = state.passesOwned || [];
        if(!state.passesOwned.includes(pack.id)) state.passesOwned.push(pack.id);
        var pMetaLoc = typeof passDef === 'function' ? passDef(pack.id) : null;
        if((pMetaLoc && pMetaLoc.maxSpeed) || pack.id === 'speed-3x'){
          state.battleSpeed = (pMetaLoc && pMetaLoc.maxSpeed) || 3;
          if(typeof bt !== 'undefined' && bt) bt.speed = battleSpeedEff();
        }
        if(typeof srReset === 'function') srReset();
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
      rewardMsg = '+' + pack.name + ' unlocked and added to your Backpack!';
    } else if(pack.type === 'pass'){
      var pMetaMsg = typeof passDef === 'function' ? passDef(pack.id) : null;
      if (pMetaMsg && pMetaMsg.kind === 'luck' && typeof passLuckMult === 'function') {
        rewardMsg = '+' + pack.name + ' unlocked permanently (Active Pass Luck: ' + passLuckMult() + '× · No Cap)!';
      } else if (pMetaMsg && pMetaMsg.kind === 'shiny' && typeof passShinyMult === 'function' && typeof shinyChanceMult === 'function') {
        rewardMsg = '+' + pack.name + ' unlocked permanently (Active Pass Shiny: ' + passShinyMult() + '× · 1 in ' + fmtChance(100 * shinyChanceMult()) + ')!';
      } else {
        rewardMsg = '+' + pack.name + ' unlocked permanently (3× Battle Speed active)!';
      }
    } else if(pack.type === 'weather'){
      const wDef = WEATHER[pack.targetWeather] || {};
      rewardMsg = (wDef.name || pack.name) + ' is ACTIVE for ALL SERVERS for 30 minutes!';
      const wEnd = (state.weather && state.weather.endsAt) || (Date.now() + WEATHER_ROTATE_MS);
      const wBuyer = (state.weather && state.weather.activated_by) || currentUser || 'HUNTER';
      const wKey = 'gw:' + pack.targetWeather + ':' + wBuyer + ':' + Math.round(Number(wEnd) / 1000);
      showGlobalEventBroadcast({
        key: wKey,
        color: wDef.color || '#38bdf8',
        badge: 'SERVER EVENT · INSTANT WEATHER',
        kind: 'weather', weatherId: pack.targetWeather, name: (wDef.name || pack.name), mult: (wDef.luckBonus || 1) + '\u00d7 LUCK \u00b7 ' + (wDef.speedBonus || 1) + '\u00d7 SPEED', sub: 'SERVER-WIDE FOR 30 MINUTES', title: (wDef.name || pack.name) + ' ACTIVATED!',
        buyer: wBuyer,
        effect: 'SERVER-WIDE BUFF: <b>' + (wDef.luckBonus || 1) + '× LUCK</b> & <b>' + (wDef.speedBonus || 1) + '× ROLL SPEED</b> FOR 30 MINUTES!',
        iconHtml: weatherSvg(pack.targetWeather, 42)
      });
    } else {
      rewardMsg = '+' + qty + ' x ' + pack.name + ' added to your Backpack (' + (Number(pack.amount || 0) * qty).toLocaleString('en-US') + ' pulls)!';
    }

    toast('PURCHASE SUCCESSFUL!', rewardMsg, pack.type === 'weather' ? (WEATHER[pack.targetWeather]?.color || '#FFD700') : '#FFD700');
    save();
    renderPremiumShop();
    renderShell();
    if(typeof updateProfileLiveNumbers === 'function') updateProfileLiveNumbers();
    if(typeof renderWeatherDock === 'function') renderWeatherDock();
    if(typeof renderBackpackPanel === 'function') renderBackpackPanel();
    if(typeof renderSettings === 'function' && document.body.classList.contains('on-settings')) renderSettings();
    if(typeof renderWeatherMachine === 'function' && document.getElementById('weatherMachineModal')?.classList.contains('show')) {
      renderWeatherMachine();
    }
    console.log('[BUY PREMIUM] Success! state.premiumGems:', state.premiumGems);
  } catch(err){
    console.error('Buy pack error:', err);
    toast('ERROR', 'Something went wrong during the transaction', '#f87171');
  } finally {
    if(btn){
      var curSel = pxSelItem();
      var curOwn = curSel ? pxOwnedInfo(curSel).owned : false;
      var curCost = curSel ? Number(curSel.price || 0) * (curSel.type === 'pack' ? pxQty : 1) : 0;
      var curAfford = ((state && state.premiumGems) || 0) >= curCost;
      btn.disabled = !!(curOwn || !curAfford);
    }
  }
}

window.openPremiumShop = openPremiumShop;
window.closePremiumShop = closePremiumShop;
window.buyPremiumPack = buyPremiumPack;
window.premSetTab = premSetTab;



/* =============== WEATHER MACHINE (HAZARD) — port desain layar TRAITS ===============
   Shell memakai class .ts-* dari css/trait-screen.css (top bar, subject stage,
   chances rail, footer). File ini hanya menambah bagian khas cuaca: kartu
   potion, pity mini, dan rail target tunggal. Semua teks English. */
let wmMultiN = 1;
let wmAutoTarget = null;
let wmAutoRunning = false;
let wmAutoTimer = null;
let wmAutoCount = 0;
let wmRenderTimer = null;

function wmRemaining(){
  return (state && state.weather && state.weather.endsAt && state.weather.endsAt > Date.now())
    ? fmtCountdown(state.weather.endsAt - Date.now())
    : '00:00';
}
function wmCurDef(){
  const aw = activeWeatherId();
  if(aw && WEATHER[aw]) return WEATHER[aw];
  return {id:null, name:'NO CLIMATE', rar:'IDLE', color:'#9A8A8B', luckBonus:1, speedBonus:1};
}
function wmPityLeft(){
  const p = (state && state.wpity) || {r:0, m:0};
  return {
    r: Math.max(0, PITY_RARE - (p.r || 0)),
    m: Math.max(0, PITY_MYTHIC - (p.m || 0))
  };
}
function wmPct(w){
  const p = w.dropWeight / 100;
  return (p < 1 ? p.toFixed(2) : p.toFixed(1)) + '%';
}
function wmOddsLabel(w){
  return '1 IN ' + fmt(Math.round(10000 / w.dropWeight));
}
function wmStatsHtml(w){
  const l = w.luckBonus > 1 ? '<span class="ts-stat"><i>LUCK</i><b>+' + Math.round((w.luckBonus - 1) * 100) + '%</b></span>' : '';
  const s = w.speedBonus > 1 ? '<span class="ts-stat"><i>SPEED</i><b>+' + Math.round((w.speedBonus - 1) * 100) + '%</b></span>' : '';
  const d = '<span class="ts-stat"><i>DURATION</i><b>' + wmRemaining() + '</b></span>';
  return (l + s + d) || '<span class="ts-stat empty"><b>NO MODIFIER</b></span>';
}
function wmNoteText(){
  return activeWeatherId()
    ? 'Live atmospheric modifier bound to this run. Synthesizing again overwrites it.'
    : 'No climate installed. Synthesize one with a Weather Potion.';
}
function wmRailRow(w){
  const aw = activeWeatherId();
  const own = aw === w.id;
  const on = wmAutoTarget === w.id;
  const bar = Math.min(100, Math.max(2, (w.dropWeight / 3511) * 100));
  return '<div class="tsr-row' + (on ? ' on' : '') + (own ? ' active' : '') + '" data-wid="' + w.id + '" style="--tcol:' + w.color + '" role="button" tabindex="0" aria-pressed="' + on + '">' +
    '<span class="tsr-gem" aria-hidden="true">' + weatherMachineIconHtml(w.id) + '</span>' +
    '<span class="tsr-name">' + w.name + '<span class="tsr-rar">' + w.rar + '</span>' + (own ? '<span class="tsr-cur">ACTIVE</span>' : '') + '</span>' +
    '<span class="tsr-chance">' + wmPct(w) + '<small>' + wmOddsLabel(w) + '</small></span>' +
    '<span class="tsr-stats">LUCK <b>×' + w.luckBonus + '</b> · SPEED <b>×' + w.speedBonus + '</b></span>' +
    '<span class="tsr-bar"><i style="width:' + bar + '%"></i></span>' +
    '<span class="tsr-tgt"><span class="tsr-tgt-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span></span>' +
  '</div>';
}

function openWeatherMachine(){
  wmAutoRunning = false;
  if(wmAutoTimer) clearTimeout(wmAutoTimer);
  wmAutoTimer = null;
  wmAutoCount = 0;
  renderWeatherMachine();
  if(wmRenderTimer) clearInterval(wmRenderTimer);
  wmRenderTimer = setInterval(function(){ if(!wmAutoRunning) wmPaintState(); }, 1000);
  const modal = document.getElementById('weatherMachineModal');
  if(modal){
    modal.classList.add('show');
    /* klik area kosong (di luar shell) = tutup, sama seperti versi lama */
    modal.onclick = function(e){ if(e.target === modal) closeWeatherMachine(); };
  }
  document.body.classList.add('hide-docks-modal', 'weather-open');
  wmBannerOpen();
}

function closeWeatherMachine(){
  if(wmRenderTimer){ clearInterval(wmRenderTimer); wmRenderTimer = null; }
  wmStopAuto(true);
  const modal = document.getElementById('weatherMachineModal');
  wmBannerClose(function(){
    if(modal) modal.classList.remove('show');
    document.body.classList.remove('hide-docks-modal', 'weather-open');
  });
}

function setWmMulti(n){
  wmMultiN = n;
  wmPaintState();
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
    toast('NO POTIONS', 'No Weather Potion left in supply.', '#f87171');
    beep(240, 0.12, 'square', 0.08);
    wmStopAuto();
    return false;
  }
  if(n > 1){
    const w = best || last;
    toast(done + '× SYNTHESIS', switches ? ('Climate shifted: ' + w.name + ' (' + switches + '× shift)') : ('Climate stable (' + kept + '× same or lower)'), w.color);
  } else {
    toast(last.name, last.rar + ' WEATHER', last.color);
  }
  beep(520, 0.1, 'triangle', 0.08);
  setTimeout(function(){ beep(780, 0.15, 'triangle', 0.09); }, 80);
  save();
  wmPaintState();
  renderShell();
  if(!battleLive() && typeof render === 'function') render();
  return true;
}

function wmToggleAuto(){
  if(wmAutoRunning){ wmStopAuto(); return; }
  if(!wmAutoTarget){
    toast('SELECT TARGET', 'Check one climate in the odds rail first.', '#fcd34d');
    beep(240, 0.12, 'square', 0.08);
    return;
  }
  if((state.potions || 0) < 1){
    toast('NO POTIONS', 'A Weather Potion is required to start auto synthesis.', '#f87171');
    return;
  }
  wmAutoRunning = true;
  wmAutoCount = 0;
  wmPaintState();
  wmAutoLoop();
}

function wmStopAuto(quiet){
  wmAutoRunning = false;
  if(wmAutoTimer) clearTimeout(wmAutoTimer);
  wmAutoTimer = null;
  if(!quiet) renderWeatherMachine();
  /* Auto loop cuma paint layar mesin; dock lobby tetap harus ikut cuaca terakhir. */
  try{ renderWeatherDock(); renderBuffDock(); }catch(e){}
}

function wmPaintRail(){
  const aw = activeWeatherId();
  document.querySelectorAll('#wmRailList .tsr-row').forEach(function(row){
    const wid = row.getAttribute('data-wid');
    const on = wmAutoTarget === wid;
    const own = aw === wid;
    row.classList.toggle('on', on);
    row.classList.toggle('active', own);
    row.setAttribute('aria-pressed', on ? 'true' : 'false');
    const nameBox = row.querySelector('.tsr-name');
    if(!nameBox) return;
    const old = nameBox.querySelector('.tsr-cur');
    if(old) old.remove();
    if(own){
      const flag = document.createElement('span');
      flag.className = 'tsr-cur';
      flag.textContent = 'ACTIVE';
      nameBox.appendChild(flag);
    }
  });
  const set = function(id, v){ const e = document.getElementById(id); if(e) e.textContent = v; };
  set('wmRailN', '(' + (wmAutoTarget ? 1 : 0) + ' ARMED)');
  const cur = wmCurDef();
  set('wmFootSel', 'ACTIVE · ' + cur.name);
}

function wmPaintState(){
  const aw = activeWeatherId();
  const cur = wmCurDef();
  const pot = (state && state.potions) || 0;
  const pl = wmPityLeft();
  const set = function(id, v){ const e = document.getElementById(id); if(e) e.textContent = v; };
  set('wmPotCount', String(pot));
  set('wmPotVal', fmt(pot));
  set('wmActiveTime', wmRemaining());
  set('wmName', cur.name);
  set('wmRar', cur.rar);
  set('wmCardName', cur.name);
  set('wmCardCode', 'WEATHER · ' + cur.rar);
  set('wmKickCode', 'CORE // ' + cur.rar);
  set('wmNote', wmNoteText());
  const card = document.getElementById('wmCard');
  if(card) card.style.setProperty('--tcol', cur.color);
  const cardImg = document.getElementById('wmCardImg');
  if(cardImg){
    const nextSrc = weatherPotionSrc(aw, false);
    if(cardImg.getAttribute('src') !== nextSrc) cardImg.setAttribute('src', nextSrc);
    cardImg.alt = cur.name;
  }
  const plate = document.getElementById('wmPlate');
  if(plate) plate.style.setProperty('--tcol', cur.color);
  const gem = document.getElementById('wmGem');
  if(gem){
    const gemKey = aw || 'idle';
    if(gem.dataset.wid !== gemKey){
      gem.dataset.wid = gemKey;
      gem.innerHTML = weatherMachineIconHtml(aw);
    }
  }
  const stats = document.getElementById('wmStats');
  if(stats) stats.innerHTML = wmStatsHtml(cur);
  set('wmPityR', fmt(pl.r) + ' SYNTHESIS');
  set('wmPityM', fmt(pl.m) + ' SYNTHESIS');
  const br = document.getElementById('wmPityRBar');
  if(br) br.style.width = Math.min(100, (PITY_RARE - pl.r) / PITY_RARE * 100).toFixed(1) + '%';
  const bm = document.getElementById('wmPityMBar');
  if(bm) bm.style.width = Math.min(100, (PITY_MYTHIC - pl.m) / PITY_MYTHIC * 100).toFixed(1) + '%';
  const st = document.getElementById('wmStatus');
  if(st) st.classList.toggle('run', wmAutoRunning);
  set('wmStatusTxt', wmAutoRunning ? 'OVERCLOCK · CYCLE 140MS' : 'IDLE · CYCLE 140MS');
  set('wmIter', 'ITER #' + wmAutoCount);
  const ab = document.getElementById('wmAutoBtn');
  if(ab){
    ab.classList.toggle('live', wmAutoRunning);
    ab.disabled = !wmAutoRunning && pot < 1;
    const lbl = document.getElementById('wmAutoLabel');
    if(lbl) lbl.textContent = wmAutoRunning ? 'ABORT AUTO' : 'AUTO SYNTHESIS';
    const sub = document.getElementById('wmAutoSub');
    if(sub) sub.textContent = wmAutoRunning ? 'overclock running' : 'until target hit';
  }
  const rb = document.getElementById('wmRollBtn');
  if(rb) rb.disabled = pot < 1 || wmAutoRunning;
  const cv = document.getElementById('coinVal');
  if(cv) cv.textContent = fmt(state.coins);
  wmPaintRail();
}

function wmFxTick(){
  const plate = document.getElementById('wmPlate');
  if(plate){ plate.classList.remove('tr-tick'); void plate.offsetWidth; plate.classList.add('tr-tick'); }
  const iter = document.getElementById('wmIter');
  if(iter){ iter.classList.remove('tr-n-pop'); void iter.offsetWidth; iter.classList.add('tr-n-pop'); }
  document.querySelectorAll('#wmRailList .tsr-row.trr-hit').forEach(function(el){ el.classList.remove('trr-hit'); });
  const own = document.querySelector('#wmRailList .tsr-row.active');
  if(own){ void own.offsetWidth; own.classList.add('trr-hit'); }
}

function wmAutoLoop(){
  if(!wmAutoRunning) return;
  if((state.potions || 0) < 1){
    toast('AUTO COMPLETE', 'Weather Potion supply is empty.', '#f87171');
    wmStopAuto();
    return;
  }
  wmAutoCount++;
  const r = useWeatherPotion();
  if(!r.ok){ wmStopAuto(); return; }
  save();
  wmPaintState();
  wmFxTick();
  const cur = activeWeatherId();
  if(cur && cur === wmAutoTarget){
    beep(720, 0.2, 'triangle', 0.1);
    setTimeout(function(){ beep(960, 0.25, 'triangle', 0.12); }, 120);
    toast('TARGET HIT', WEATHER[cur].name + ' activated on iteration #' + wmAutoCount, WEATHER[cur].color);
    wmStopAuto();
    if(!battleLive() && typeof render === 'function') render();
    renderShell();
    return;
  }
  wmAutoTimer = setTimeout(wmAutoLoop, 140);
}

function wmSelectTarget(wId){
  wmAutoTarget = (wmAutoTarget === wId) ? null : wId;
  wmPaintState();
}

function renderWeatherMachine(){
  const bodyEl = document.getElementById('wmBody');
  if(!bodyEl) return;
  const aw = activeWeatherId();
  const cur = wmCurDef();
  const pot = (state && state.potions) || 0;
  const pl = wmPityLeft();
  const rows = WEATHERS.map(wmRailRow).join('');
  const rPct = Math.min(100, (PITY_RARE - pl.r) / PITY_RARE * 100).toFixed(1);
  const mPct = Math.min(100, (PITY_MYTHIC - pl.m) / PITY_MYTHIC * 100).toFixed(1);

  bodyEl.innerHTML =
    '<div class="ts-shell">' +
      '<header class="ts-top">' +
        '<div class="ts-mark">' +
          '<span class="ts-mark-t">WEATHER</span>' +
          '<span class="ts-mark-s">ATMOSPHERIC MATRIX</span>' +
        '</div>' +
        '<div class="ts-topmid">' +
          '<div class="ts-crumb"><i></i><span>LAB</span><span class="sep">/</span><b>SYNTHESIS</b><span class="sep">/</span><span>CLIMATE</span></div>' +
          '<div class="ts-topstat">' +
            '<div class="ts-ts"><span class="ts-ts-k">POTIONS</span><span class="ts-ts-v hz" id="wmPotCount">' + pot + '</span></div>' +
            '<div class="ts-ts"><span class="ts-ts-k">ACTIVE</span><span class="ts-ts-v" id="wmActiveTime">' + wmRemaining() + '</span></div>' +
          '</div>' +
        '</div>' +
        '<button class="ts-x" id="wmShellClose" aria-label="Close weather machine" title="Close [ESC]">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>' +
        '</button>' +
      '</header>' +

      '<div class="ts-body">' +
        '<section class="ts-left" aria-label="Atmospheric node">' +
          '<div class="ts-kicker"><i></i><b>ATMOSPHERIC NODE</b><span>·</span><span id="wmKickCode">CORE // ' + cur.rar + '</span></div>' +
          '<div class="ts-subject">' +
            '<div class="ts-card ts-weather-card" id="wmCard" style="--tcol:' + cur.color + '" title="Weather Potion supply">' +
              '<span class="ts-corner tl"></span><span class="ts-corner tr"></span>' +
              '<span class="ts-corner bl"></span><span class="ts-corner br"></span>' +
              '<span class="ts-card-hint">LIVE CLIMATE</span>' +
              '<span class="ts-card-scan"></span>' +
              '<img id="wmCardImg" src="' + weatherPotionSrc(aw, false) + '" alt="' + cur.name + '" decoding="async">' +
              '<div class="ts-card-meta"><div>' +
                '<div class="ts-card-name" id="wmCardName">' + cur.name + '</div>' +
                '<div class="ts-card-code" id="wmCardCode">WEATHER · ' + cur.rar + '</div>' +
              '</div></div>' +
            '</div>' +

            '<div class="ts-traitplate" id="wmPlate" style="--tcol:' + cur.color + '">' +
              '<div class="ts-tp-top">' +
                '<span class="ts-tp-gem" id="wmGem" data-wid="' + (aw || 'idle') + '" aria-hidden="true">' + weatherMachineIconHtml(aw) + '</span>' +
                '<span class="ts-tp-name" id="wmName">' + cur.name + '</span>' +
                '<span class="ts-tp-rar" id="wmRar">' + cur.rar + '</span>' +
              '</div>' +
              '<div class="ts-tp-stats" id="wmStats">' + wmStatsHtml(cur) + '</div>' +
              '<div class="ts-tp-note" id="wmNote">' + wmNoteText() + '</div>' +
            '</div>' +

            '<div class="wm-pity-mini">' +
              '<div class="wm-pity-row"><span>RARE GUARANTEED IN</span><span class="wm-pity-track"><i id="wmPityRBar" style="width:' + rPct + '%"></i></span><b id="wmPityR">' + fmt(pl.r) + ' SYNTHESIS</b></div>' +
              '<div class="wm-pity-row"><span>AWAKENED GUARANTEED IN</span><span class="wm-pity-track"><i id="wmPityMBar" style="width:' + mPct + '%"></i></span><b id="wmPityM">' + fmt(pl.m) + ' SYNTHESIS</b></div>' +
            '</div>' +

            '<div class="ts-actions wm-actions">' +
              '<button class="ts-btn' + (wmAutoRunning ? ' live' : '') + '" id="wmAutoBtn"' + (!wmAutoRunning && pot < 1 ? ' disabled' : '') + '>' +
                '<span id="wmAutoLabel">' + (wmAutoRunning ? 'ABORT AUTO' : 'AUTO SYNTHESIS') + '</span>' +
                '<small id="wmAutoSub">' + (wmAutoRunning ? 'overclock running' : 'until target hit') + '</small>' +
              '</button>' +
              '<button class="ts-btn primary" id="wmRollBtn"' + (pot < 1 || wmAutoRunning ? ' disabled' : '') + '>' +
                '<span>SYNTHESIZE</span>' +
                '<small>1× POTION</small>' +
              '</button>' +
            '</div>' +

            '<div class="ts-balance">' +
              '<div class="ts-coin">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h10l4 6-9 12L3 9z"/><path d="M3 9h18"/></svg>' +
                '<span>POTIONS</span><b id="wmPotVal">' + fmt(pot) + '</b>' +
              '</div>' +
              '<div class="ts-bal-note"><b>1 POTION</b> PER SYNTHESIS · AUTO CHARGES EACH ITERATION</div>' +
            '</div>' +

            '<div class="ts-status' + (wmAutoRunning ? ' run' : '') + '" id="wmStatus">' +
              '<span class="dot"></span>' +
              '<span id="wmStatusTxt">' + (wmAutoRunning ? 'OVERCLOCK · CYCLE 140MS' : 'IDLE · CYCLE 140MS') + '</span>' +
              '<span class="iter" id="wmIter">ITER #' + wmAutoCount + '</span>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<aside class="ts-rail" aria-label="Climate odds">' +
          '<div class="tsr-head">' +
            '<div class="tsr-title">CLIMATE <b id="wmRailN">(' + (wmAutoTarget ? 1 : 0) + ' ARMED)</b></div>' +
            '<div class="tsr-sub">CHECK = AUTO TARGET</div>' +
          '</div>' +
          '<div class="tsr-list" id="wmRailList">' + rows + '</div>' +
          '<div class="tsr-foot">Probabilities are the live weather weights and total <b>100%</b>.<br>Checked climate halts AUTO SYNTHESIS the moment it lands.</div>' +
        '</aside>' +
      '</div>' +

      '<footer class="ts-foot">' +
        '<span><b>CHECK ROW</b> auto target</span>' +
        '<span><b>PITY</b> rare 100 · awakened 250</span>' +
        '<span class="haz" id="wmFootSel">ACTIVE · ' + cur.name + '</span>' +
      '</footer>' +
    '</div>';

  const x = document.getElementById('wmShellClose');
  if(x) x.onclick = closeWeatherMachine;
  const rb = document.getElementById('wmRollBtn');
  if(rb) rb.onclick = function(){ wmSynthesizeRoll(); };
  const ab = document.getElementById('wmAutoBtn');
  if(ab) ab.onclick = wmToggleAuto;
  const list = document.getElementById('wmRailList');
  if(list) list.querySelectorAll('.tsr-row').forEach(function(row){
    const wid = row.getAttribute('data-wid');
    const act = function(){ wmSelectTarget(wid); };
    row.onclick = act;
    row.onkeydown = function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); act(); } };
  });
  wmPaintState();
}

/* ===== hazard banner masuk/keluar (pola #traitCurtain) ===== */
let wmHzTimers = [];
function wmHzClear(){ for(let i = 0; i < wmHzTimers.length; i++) clearTimeout(wmHzTimers[i]); wmHzTimers = []; }
function wmHzSetCopy(mode){
  const kick = document.getElementById('wmHzKick'), title = document.getElementById('wmHzTitle'),
        sub = document.getElementById('wmHzSub'), foot = document.getElementById('wmHzFoot'),
        serial = document.getElementById('wmHzSerial'), water = document.getElementById('wmHzWater');
  if(serial) serial.textContent = (0x1000 + Math.floor(Math.random() * 0xefff)).toString(16).toUpperCase();
  if(mode === 'open'){
    if(kick) kick.innerHTML = '// CLIMATE <b>SYNC</b>';
    if(title) title.textContent = 'WEATHER';
    if(water) water.textContent = 'SKY';
    if(sub) sub.textContent = 'ATMOSPHERIC MATRIX · POTIONS · TARGETS';
    if(foot) foot.textContent = 'ENTER SYNTHESIS';
  } else {
    if(kick) kick.innerHTML = '// LINK <b>STAND BY</b>';
    if(title) title.textContent = 'HOLD';
    if(water) water.textContent = 'OUT';
    if(sub) sub.textContent = 'MATRIX DISCONNECTING · DATA SAVED';
    if(foot) foot.textContent = 'CLOSE SESSION';
  }
}
function wmBannerOpen(){
  const c = document.getElementById('weatherCurtain');
  if(!c) return;
  wmHzClear(); wmHzSetCopy('open');
  c.className = ''; void c.offsetWidth;
  c.classList.add('on', 'smooth', 'sweep');
  wmHzTimers.push(setTimeout(function(){ c.classList.add('revealed'); }, 1080));
  wmHzTimers.push(setTimeout(function(){ c.classList.remove('on', 'smooth', 'sweep', 'revealed'); }, 1800));
}
function wmBannerClose(onCovered){
  const c = document.getElementById('weatherCurtain');
  if(!c){ if(onCovered) onCovered(); return; }
  wmHzClear(); wmHzSetCopy('close');
  c.className = ''; c.classList.add('on', 'smooth', 'revealed'); void c.offsetWidth;
  c.classList.remove('revealed');
  wmHzTimers.push(setTimeout(function(){ if(onCovered) onCovered(); }, 560));
  wmHzTimers.push(setTimeout(function(){ c.classList.add('revealed'); }, 780));
  wmHzTimers.push(setTimeout(function(){ c.classList.remove('on', 'smooth', 'revealed'); }, 1560));
}

document.addEventListener('keydown', function(e){
  if(e.key !== 'Escape') return;
  const m = document.getElementById('weatherMachineModal');
  if(!m || !m.classList.contains('show')) return;
  closeWeatherMachine();
});

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
        color: '#f3e600',
        badge: 'SERVER EVENT · GLOBAL LUCK SHRINE',
        kind: 'luck', name: 'GLOBAL LUCK', mult: '\u00d7' + gl.multiplier + ' BOOST', sub: stacks + ' STACKS \u00b7 ACTIVE FOR ALL PLAYERS', chips: '\u00d7' + gl.multiplier, title: 'GLOBAL LUCK ' + gl.multiplier + '\u00d7 ACTIVE!',
        buyer: gl.activated_by || 'HUNTER',
        effect: 'SERVER-WIDE BOOST: <b>' + gl.multiplier + '× LUCK (' + stacks + ' STACKS)</b> FOR ALL PLAYERS!',
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
/* ---- Hazard confirm dialog (Premium Exchange) — pengganti popup lama ---- */
function pxConfirmDialog(opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    var host = document.getElementById('pxConfirmHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'pxConfirmHost';
      document.body.appendChild(host);
    }
    var options = opts.options || [];
    var selected = opts.selected !== undefined ? opts.selected : (options.length ? options[0].value : null);

    function pick() {
      for (var i = 0; i < options.length; i++) if (options[i].value === selected) return options[i];
      return null;
    }
    function bodyHTML() {
      if (!options.length) return opts.body || '';
      var cur = pick();
      return (cur && cur.body) || opts.body || '';
    }
    function okText() {
      if (!options.length) return opts.okText || 'CONFIRM';
      var cur = pick();
      return (cur && cur.okText) || opts.okText || 'CONFIRM';
    }
    function totalHTML() {
      if (!opts.totalLabel) return '';
      return '<div class="pxcf-total"><k>' + opts.totalLabel + '</k>' +
        '<v><img src="assets/images/premium-currency.webp" alt="Gem" width="14" height="14"><b>' + opts.totalValue + '</b><small>GEMS</small></v></div>';
    }
    function chipsHTML() {
      if (!options.length) return '';
      return '<div class="pxcf-sec"><div class="pxcf-sec-h"><b>QUANTITY</b><i></i><span>SELECT ONE</span></div>' +
        '<div class="pxcf-chips">' + options.map(function (o) {
          return '<button type="button" class="pxcf-chip' + (o.value === selected ? ' on' : '') + '" data-val="' + o.value + '">' + o.label + '</button>';
        }).join('') + '</div></div>';
    }
    function artHTML() {
      return opts.img
        ? '<div class="pxcf-art"><i class="halo"></i><img src="' + opts.img + '" alt="" width="72" height="72" decoding="async" onerror="this.remove()"></div>'
        : '';
    }

    host.innerHTML =
      '<div class="pxcf-backdrop">' +
        '<div class="pxcf-box" role="dialog" aria-modal="true" aria-label="' + (opts.title || 'Purchase confirmation') + '">' +
          '<span class="pxcf-corner tl"></span><span class="pxcf-corner tr"></span>' +
          '<span class="pxcf-corner bl"></span><span class="pxcf-corner br"></span>' +
          '<div class="pxcf-head">' +
            '<div class="pxcf-krow"><span class="pxcf-dot"></span>' +
              '<span class="pxcf-kick">// ORDER <b>VERIFICATION</b></span>' +
              '<span class="pxcf-serial">SECURE 0x' + (0x1000 + Math.floor(Math.random() * 0xefff)).toString(16).toUpperCase() + '</span>' +
            '</div>' +
            '<div class="pxcf-title">' + (opts.title || 'PURCHASE CONFIRMATION') + '</div>' +
          '</div>' +
          '<div class="pxcf-body">' +
            '<div class="pxcf-top">' + artHTML() +
              '<div class="pxcf-main">' + bodyHTML() + '</div>' +
            '</div>' +
            chipsHTML() +
          '</div>' +
          totalHTML() +
          '<div class="pxcf-actions">' +
            '<button class="pxcf-btn pxcf-btn--cancel" type="button">CANCEL</button>' +
            '<button class="pxcf-btn pxcf-btn--ok" type="button">' + okText() + '</button>' +
          '</div>' +
          '<div class="pxcf-foot"><span>HZ-PROTOCOL</span><i></i><span>INSTANT DELIVERY · NO REFUNDS</span></div>' +
        '</div>' +
      '</div>';

    function close(val) {
      host.innerHTML = '';
      document.removeEventListener('keydown', onKey);
      resolve(val);
    }
    function onKey(e) { if (e.key === 'Escape') close(null); }
    document.addEventListener('keydown', onKey);
    host.querySelector('.pxcf-btn--cancel').onclick = function () { close(null); };
    host.querySelector('.pxcf-btn--ok').onclick = function () { close(options.length ? selected : true); };
    host.querySelector('.pxcf-backdrop').onclick = function (e) { if (e.target === this) close(null); };

    var chips = host.querySelector('.pxcf-chips');
    if (chips) {
      chips.onclick = function (e) {
        var b = e.target.closest ? e.target.closest('.pxcf-chip') : null;
        if (!b) return;
        selected = b.getAttribute('data-val');
        chips.querySelectorAll('.pxcf-chip').forEach(function (x) { x.classList.toggle('on', x === b); });
        host.querySelector('.pxcf-main').innerHTML = bodyHTML();
        host.querySelector('.pxcf-btn--ok').textContent = okText();
        var cur = pick();
        var tv = host.querySelector('.pxcf-total b');
        if (tv && cur && cur.total !== undefined) tv.textContent = cur.total;
        var tk = host.querySelector('.pxcf-total k');
        if (tk && cur && cur.totalLabel) tk.textContent = cur.totalLabel;
      };
    }
  });
}
window.pxConfirmDialog = pxConfirmDialog;

function showConfirmDialog(opts) {
  if (opts && opts.variant === 'hazard') return pxConfirmDialog(opts);
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

    var artHTML = opts.img
      ? '<img class="glcf-item-art" src="' + opts.img + '" alt="" width="72" height="72" decoding="async" onerror="this.remove()">'
      : '';
    host.innerHTML =
      '<div class="glcf-backdrop">' +
        '<div class="glcf-box">' +
          artHTML +
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
      toast('NOT ENOUGH GEMS', 'Need ' + GLOBAL_LUCK_COST.toLocaleString('en-US') + ' Gems', '#f87171');
      return;
    }

    const existing = await fetchGlobalLuck();
    if (existing && (existing.multiplier || 0) >= GLOBAL_LUCK_MAX_MULT) {
      toast('MAX STACK REACHED', 'Global Luck is already at 100× — cannot stack further', '#fcd34d');
      return;
    }

    const username = currentUser || 'GUEST';
    const isStack = !!existing;
    const prevMult = existing ? (existing.multiplier || 0) : 0;
    let newMult = Math.min(prevMult + GLOBAL_LUCK_STEP_MULT, GLOBAL_LUCK_MAX_MULT);

    /* --- Hazard confirmation popup before purchasing --- */
    const gemIcon = '<img class="glcf-gem-icon" src="assets/images/premium-currency.webp" alt="" width="16" height="16">';
    const confirmBody =
      '<div class="glcf-row"><span class="glcf-label">EFFECT</span><span class="glcf-val">' +
        (isStack
          ? 'Stacks to <b>' + newMult + 'x LUCK</b> (from ' + prevMult + 'x)'
          : 'Activates <b>' + newMult + 'x LUCK</b> for every player') +
      '</span></div>' +
      '<div class="glcf-row"><span class="glcf-label">DURATION</span><span class="glcf-val">+1 HOUR per activation (max 10 hours)</span></div>' +
      '<div class="glcf-row"><span class="glcf-label">PRICE</span><span class="glcf-val">' + gemIcon + ' ' + GLOBAL_LUCK_COST.toLocaleString('en-US') + ' Gems</span></div>' +
      '<div class="glcf-row"><span class="glcf-label">BALANCE</span><span class="glcf-val">' + gemIcon + ' ' + (state.premiumGems || 0).toLocaleString('en-US') + ' Gems</span></div>' +
      '<div class="glcf-warn">Gems are charged immediately and <b>cannot be refunded</b>. The activation applies to the entire server.</div>';

    const glPack = (typeof PREMIUM_PACKS !== 'undefined') ? PREMIUM_PACKS.find(function(x){ return x.id === 'global_luck'; }) : null;
    const ok = await showConfirmDialog({
      variant: 'hazard',
      title: isStack ? 'STACK GLOBAL LUCK' : 'ACTIVATE GLOBAL LUCK',
      img: (glPack && glPack.img) || 'assets/images/premium-currency.webp',
      body: confirmBody,
      okText: (isStack ? 'STACK' : 'ACTIVATE') + ' · ' + GLOBAL_LUCK_COST.toLocaleString('en-US') + ' GEMS',
      totalLabel: 'TOTAL',
      totalValue: GLOBAL_LUCK_COST.toLocaleString('en-US')
    });
    if (!ok) {
      toast('CANCELLED', 'Global Luck purchase cancelled', '#94a3b8');
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
        toast('FAILED', (res && res.msg) || 'Transaction failed', '#f87171');
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
    showGlobalEventBroadcast({
      key: 'gl:' + newMult + ':' + (res.activated_by || username) + ':' + res.ends_at,
      color: '#f3e600',
      badge: 'SERVER EVENT · GLOBAL LUCK SHRINE',
      kind: 'luck', name: 'GLOBAL LUCK', mult: '\u00d7' + newMult + ' BOOST', sub: stacks + ' STACKS \u00b7 ACTIVE FOR ALL PLAYERS', chips: '\u00d7' + newMult, title: 'GLOBAL LUCK ' + newMult + '\u00d7 ACTIVE!',
      buyer: res.activated_by || username,
      effect: 'SERVER-WIDE BOOST: <b>' + newMult + '× LUCK (' + stacks + ' STACKS)</b> FOR ALL PLAYERS!',
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
    try { toast('TOP-UP DISABLED', 'Gems are earned by grinding: Tower, Raid Boss & Story.', '#ffd700'); } catch (e) {}
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
    try { toast('TOP-UP DISABLED', 'Gems are earned by grinding: Tower, Raid Boss & Story.', '#ffd700'); } catch (e) {}
    return;
  }
  if (window.Topup && typeof window.Topup.buy === 'function') {
    const pack = TOPUP_PACKS.find(function(p){ return p.gems === gemsAmount; });
    if (pack) return window.Topup.buy(pack.id);
  }
  toast('ERROR', 'Top-up module not ready. Reload the page.', '#f87171');
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
var _watchAdsSimKind = null;
var _watchAdsSimSecLeft = 0;
var _watchAdsDoneKind = null;
var _watchAdsSimTimer = null;
var _watchAdsDoneTimer = null;
var _watchAdsClaims = 0;
var _waCurtainT = [];

function waClearT() {
  for (var i = 0; i < _waCurtainT.length; i++) clearTimeout(_waCurtainT[i]);
  _waCurtainT = [];
}
function waSetCopy(mode) {
  var kick = document.getElementById('waHZKick');
  var title = document.getElementById('waHZTitle');
  var sub = document.getElementById('waHZSub');
  var foot = document.getElementById('waHZFoot');
  var serial = document.getElementById('waHZSerial');
  var water = document.getElementById('waHZWater');
  if (serial) serial.textContent = (0x1000 + Math.floor(Math.random() * 0xefff)).toString(16).toUpperCase();
  if (mode === 'open') {
    if (kick) kick.innerHTML = '// SPONSORED <b>UPLINK</b>';
    if (title) title.textContent = 'WATCH ADS';
    if (water) water.textContent = 'ADS';
    if (sub) sub.textContent = 'SPONSORED TERMINAL — 2× LUCK · 100K PACK';
    if (foot) foot.textContent = 'ESTABLISH UPLINK';
  } else {
    if (kick) kick.innerHTML = '// LINK <b>STAND BY</b>';
    if (title) title.textContent = 'HOLD';
    if (water) water.textContent = 'OUT';
    if (sub) sub.textContent = 'TERMINAL DISCONNECTING — TIMERS SYNCED';
    if (foot) foot.textContent = 'CLOSE SESSION';
  }
}
function waBannerOpen() {
  var c = document.getElementById('watchAdsCurtain');
  if (!c) return;
  waClearT();
  waSetCopy('open');
  c.className = '';
  void c.offsetWidth;
  c.classList.add('on', 'smooth', 'sweep');
  _waCurtainT.push(setTimeout(function() { c.classList.add('revealed'); }, 1080));
  _waCurtainT.push(setTimeout(function() { c.classList.remove('on', 'smooth', 'sweep', 'revealed'); }, 1800));
}
function waBannerClose(onCovered) {
  var c = document.getElementById('watchAdsCurtain');
  if (!c) { if (onCovered) onCovered(); return; }
  waClearT();
  waSetCopy('close');
  c.className = '';
  c.classList.add('on', 'smooth', 'revealed');
  void c.offsetWidth;
  c.classList.remove('revealed');
  _waCurtainT.push(setTimeout(function() { if (onCovered) onCovered(); }, 560));
  _waCurtainT.push(setTimeout(function() { c.classList.add('revealed'); }, 780));
  _waCurtainT.push(setTimeout(function() { c.classList.remove('on', 'smooth', 'revealed'); }, 1560));
}
window.waBannerOpen = waBannerOpen;
window.waBannerClose = waBannerClose;

function ensureWatchAdsModal() {
  var m = document.getElementById('watchAdsModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'watchAdsModal';
    m.className = 'wad-backdrop';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-label', 'Watch Ads Reward Terminal');
    document.body.appendChild(m);
  }
  if (!m.__waBound) {
    m.__waBound = true;
    m.addEventListener('click', function(e) {
      if (e.target === m) closeWatchAdsModal();
    });
  }
  return m;
}

document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  var m = document.getElementById('watchAdsModal');
  if (!m || !m.classList.contains('show')) return;
  e.stopPropagation();
  e.preventDefault();
  closeWatchAdsModal();
}, true);

function openWatchAdsModal() {
  var m = ensureWatchAdsModal();
  if (_watchAdsDoneTimer) { clearTimeout(_watchAdsDoneTimer); _watchAdsDoneTimer = null; }
  _watchAdsDoneKind = null;
  renderWatchAdsModal();
  m.classList.add('show');
  document.body.classList.add('wa-open', 'hide-docks-modal');
  waBannerOpen();
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

function closeWatchAdsModal(onHidden) {
  if (_watchingAdBusy) {
    try { toast('BROADCAST ACTIVE', 'Wait for the sponsored broadcast to finish before closing.', '#ffb020'); } catch (e) {}
    return;
  }
  if (_watchAdsModalTimer) {
    clearInterval(_watchAdsModalTimer);
    _watchAdsModalTimer = null;
  }
  if (_watchAdsDoneTimer) {
    clearTimeout(_watchAdsDoneTimer);
    _watchAdsDoneTimer = null;
  }
  _watchAdsDoneKind = null;
  var doHide = function() {
    var m = document.getElementById('watchAdsModal');
    if (m) m.classList.remove('show');
    document.body.classList.remove('wa-open');
    var prem = document.getElementById('premiumModal');
    var wm = document.getElementById('weatherMachineModal');
    var keepHideDocks = (prem && prem.classList.contains('show')) || (wm && wm.classList.contains('show'));
    if (!keepHideDocks) document.body.classList.remove('hide-docks-modal');
    if (typeof onHidden === 'function') onHidden();
  };
  try {
    waBannerClose(doHide);
  } catch (e) {
    doHide();
  }
}

window.openWatchAdsModal  = openWatchAdsModal;
window.closeWatchAdsModal = closeWatchAdsModal;

function waMonitorHtml() {
  if (_watchingAdBusy && _watchAdsSimKind) {
    var isLuck = _watchAdsSimKind === 'luck';
    var pct = Math.max(0, Math.min(1, (AD_WATCH_SIM_SEC - _watchAdsSimSecLeft) / AD_WATCH_SIM_SEC));
    var pctTxt = Math.round(pct * 100) + '%';
    var img = isLuck ? 'assets/images/pot-luck-3.webp' : 'assets/images/instanpack-100k.webp?v=trans1';
    var head = isLuck ? 'PREPARING 2× LUCK OVERDRIVE (5 MIN)…' : 'PREPARING INSTANT ROLL PACK 100K…';
    return '<div class="wa-monitor is-live">'
      + '<div class="wa-mon-top">'
        + '<span class="wa-mon-tag"><i></i>LIVE BROADCAST</span>'
        + '<span class="wa-mon-timer">REWARD IN ' + _watchAdsSimSecLeft + 'S · ' + pctTxt + '</span>'
      + '</div>'
      + '<div class="wa-mon-mid">'
        + '<div class="wa-mon-ic"><img src="' + img + '" alt="" onerror="this.style.display=\'none\'"></div>'
        + '<div class="wa-mon-txt">'
          + '<div class="wa-mon-head">' + head + '</div>'
          + '<div class="wa-mon-sub">SFX auto-muted during transmission · Terminal locked until completion.</div>'
        + '</div>'
      + '</div>'
      + '<div class="wa-mon-bar"><i style="transform:scaleX(' + pct.toFixed(3) + ')"></i></div>'
      + '<div class="wa-mon-chips">'
        + '<span class="wa-mon-chip hot">STREAM ACTIVE</span>'
        + '<span class="wa-mon-chip">AUDIO MUTED</span>'
        + '<span class="wa-mon-chip">CLOSE LOCKED</span>'
      + '</div>'
    + '</div>';
  }
  if (_watchAdsDoneKind) {
    var wasLuck = _watchAdsDoneKind === 'luck';
    return '<div class="wa-monitor is-done">'
      + '<div class="wa-mon-top">'
        + '<span class="wa-mon-tag"><i></i>UPLINK VERIFIED</span>'
        + '<span class="wa-mon-timer">DELIVERED</span>'
      + '</div>'
      + '<div class="wa-mon-mid">'
        + '<div class="wa-mon-ic"><svg viewBox="0 0 24 24" fill="none" stroke="#6be08a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>'
        + '<div class="wa-mon-txt">'
          + '<div class="wa-mon-head">' + (wasLuck ? '2× LUCK OVERDRIVE ACTIVE' : '100,000 CARD PULLS OPENED') + '</div>'
          + '<div class="wa-mon-sub">' + (wasLuck ? 'Timer synced to Lobby Buff Dock for 05:00.' : 'Drops added to collection · 30:00 cooldown started.') + '</div>'
        + '</div>'
      + '</div>'
      + '<div class="wa-mon-bar"><i style="transform:scaleX(1)"></i></div>'
    + '</div>';
  }
  return '<div class="wa-monitor">'
    + '<div class="wa-mon-top">'
      + '<span class="wa-mon-tag"><i></i>SIGNAL STANDBY</span>'
      + '<span class="wa-mon-timer">IDLE</span>'
    + '</div>'
    + '<div class="wa-mon-mid">'
      + '<div class="wa-mon-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><polygon points="10 9 15 12 10 15 10 9" fill="currentColor"/></svg></div>'
      + '<div class="wa-mon-txt">'
        + '<div class="wa-mon-head">AWAITING TRANSMISSION</div>'
        + '<div class="wa-mon-sub">Select a reward module on the left to start a rewarded broadcast.</div>'
      + '</div>'
    + '</div>'
    + '<div class="wa-mon-bar"><i style="transform:scaleX(0)"></i></div>'
    + '<div class="wa-mon-chips">'
      + '<span class="wa-mon-chip">CRAZYGAMES SDK v3</span>'
      + '<span class="wa-mon-chip">5S FALLBACK SIM</span>'
    + '</div>'
  + '</div>';
}

function renderWatchAdsModal() {
  var m = ensureWatchAdsModal();
  var luckMs = adLuckLeftMs();
  var packMs = adPackCdLeftMs();
  var luckActive = luckMs > 0;
  var packOnCd   = packMs > 0;
  var availCount = (luckActive ? 0 : 1) + (packOnCd ? 0 : 1);

  var luckRatio = luckActive ? Math.max(0.02, Math.min(1, luckMs / AD_LUCK_DURATION_MS)) : 1;
  var packRatio = packOnCd ? Math.max(0.02, Math.min(1, 1 - (packMs / AD_PACK_COOLDOWN_MS))) : 1;

  var luckStatusHtml = luckActive
    ? '<div class="wa-pill active"><span class="dot"></span>ACTIVE · <span id="waLuckTimer">' + fmtCountdown(luckMs) + '</span> REMAINING</div>'
    : '<div class="wa-pill ready"><span class="dot"></span>READY TO WATCH · 5-MIN BUFF</div>';

  var packStatusHtml = packOnCd
    ? '<div class="wa-pill cd"><span class="dot"></span>COOLDOWN · READY IN <span id="waPackTimer">' + fmtCountdown(packMs) + '</span></div>'
    : '<div class="wa-pill ready"><span class="dot"></span>READY TO WATCH · 30-MIN CYCLE</div>';

  var luckBtnTxt = _watchingAdBusy
    ? (_watchAdsSimKind === 'luck' ? ('BROADCASTING (' + _watchAdsSimSecLeft + 'S)…') : 'BROADCAST IN PROGRESS…')
    : (luckActive ? ('ACTIVE · ' + fmtCountdown(luckMs)) : 'WATCH AD · ACTIVATE 2× LUCK');

  var packBtnTxt = _watchingAdBusy
    ? (_watchAdsSimKind === 'pack100k' ? ('BROADCASTING (' + _watchAdsSimSecLeft + 'S)…') : 'BROADCAST IN PROGRESS…')
    : (packOnCd ? ('WAIT · ' + fmtCountdown(packMs)) : 'WATCH AD · CLAIM 100K PACK');

  var playSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
  var lockSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  var monHtml = waMonitorHtml();
  var showMob = !!(_watchingAdBusy || _watchAdsDoneKind);

  m.innerHTML = ''
    + '<div class="wa-screen">'
      + '<header class="wa-top">'
        + '<div class="wa-mark">'
          + '<span class="wa-mark-t">WATCH ADS</span>'
          + '<span class="wa-mark-s">SPONSORED TERMINAL</span>'
        + '</div>'
        + '<div class="wa-top-mid">'
          + '<div class="wa-crumb">'
            + '<i></i><span>TERMINAL</span><span class="sep">/</span>'
            + '<b>HZ-07</b><span class="sep">/</span><span>FREE REWARDS</span>'
          + '</div>'
          + '<div class="wa-top-stat">'
            + '<div class="wa-ts"><span class="wa-ts-k">AVAILABLE</span><span class="wa-ts-v ' + (availCount > 0 ? 'am' : '') + '" id="waTsAvail">' + availCount + ' / 2</span></div>'
            + '<div class="wa-ts"><span class="wa-ts-k">AD LUCK</span><span class="wa-ts-v ' + (luckActive ? 'lk' : '') + '" id="waTsLuck">' + (luckActive ? ('2× · ' + fmtCountdown(luckMs)) : '1× BASE') + '</span></div>'
          + '</div>'
        + '</div>'
        + '<button type="button" class="wa-x" id="waCloseBtn" onclick="closeWatchAdsModal()" aria-label="Close Watch Ads" title="Close [ESC]"' + (_watchingAdBusy ? ' disabled' : '') + '>'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>'
        + '</button>'
      + '</header>'

      + '<div class="wa-body">'
        + '<div class="wa-main">'
          + '<div class="wa-mob-slot' + (showMob ? ' on' : '') + '" id="waMobSlot">' + (showMob ? monHtml : '') + '</div>'

          + '<div class="wa-sec-h"><b>// SPONSORED REWARD MODULES</b><span class="rule"></span><span class="tag">2 CHANNELS</span></div>'

          + '<div class="wa-banner">'
            + '<span class="wa-banner-ic">'
              + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
                + '<rect x="2" y="5" width="20" height="14" rx="2"/><polygon points="10 9 15 12 10 15 10 9" fill="currentColor"/>'
              + '</svg>'
            + '</span>'
            + '<div>Watch a short sponsored ad to activate <em>2× Total Luck</em> for <b>5 minutes</b> or claim a free <em>100K Instant Roll Pack</em>.</div>'
          + '</div>'

          + '<div class="wa-grid">'
            /* CARD 1: 2x LUCK OVERDRIVE */
            + '<section class="wa-card luck' + (luckActive ? ' is-active' : '') + '" id="waCardLuck">'
              + '<span class="wa-card-crn br"></span>'
              + '<div class="wa-c-top">'
                + '<span class="wa-c-mod">MOD // <b>01</b></span>'
                + '<span class="wa-c-rib">5-MIN REFRESH</span>'
              + '</div>'
              + '<div class="wa-c-hero">'
                + '<div class="wa-art">'
                  + '<img src="assets/images/pot-luck-3.webp" alt="2x Luck Overdrive" onerror="this.style.display=\'none\'">'
                  + '<span class="wa-art-tag">2×</span>'
                + '</div>'
                + '<div class="wa-c-info">'
                  + '<div class="wa-c-cat">LUCK MULTIPLIER</div>'
                  + '<h2 class="wa-c-title">2× LUCK OVERDRIVE</h2>'
                  + '<p class="wa-c-desc">Doubles (<b>×2</b>) your total luck for <b>5 full minutes</b>. Watch again immediately after the buff expires.</p>'
                  + '<div class="wa-c-mini"><b>×2 TOTAL LUCK</b> · 5:00 BUFF · REWATCH ON EXPIRY</div>'
                + '</div>'
              + '</div>'
              + '<div class="wa-specs">'
                + '<div class="wa-spec hi"><k>MULTIPLIER</k><b>×2 TOTAL</b></div>'
                + '<div class="wa-spec"><k>DURATION</k><b>05:00</b></div>'
                + '<div class="wa-spec"><k>REWATCH</k><b>ON EXPIRY</b></div>'
              + '</div>'
              + '<div class="wa-stat-wrap">'
                + '<div id="waLuckStatusWrap">' + luckStatusHtml + '</div>'
                + '<div class="wa-pbar"><i id="waLuckPbar" style="transform:scaleX(' + luckRatio.toFixed(3) + ')"></i></div>'
              + '</div>'
              + '<button type="button" class="wa-cta' + (luckActive ? ' is-active' : '') + '" id="waBtnLuck" onclick="triggerWatchAd(\'luck\')"' + ((luckActive || _watchingAdBusy) ? ' disabled' : '') + '>'
                + ((luckActive || _watchingAdBusy) ? lockSvg : playSvg) + '<span id="waBtnLuckTxt">' + luckBtnTxt + '</span>'
              + '</button>'
            + '</section>'

            /* CARD 2: INSTANT ROLL PACK 100K */
            + '<section class="wa-card pack' + (packOnCd ? ' is-cd' : '') + '" id="waCardPack">'
              + '<span class="wa-card-crn br"></span>'
              + '<div class="wa-c-top">'
                + '<span class="wa-c-mod">MOD // <b>02</b></span>'
                + '<span class="wa-c-rib">30-MIN COOLDOWN</span>'
              + '</div>'
              + '<div class="wa-c-hero">'
                + '<div class="wa-art">'
                  + '<img src="assets/images/instanpack-100k.webp?v=trans1" alt="Instant Roll Pack 100K" onerror="this.style.display=\'none\'">'
                  + '<span class="wa-art-tag">100K</span>'
                + '</div>'
                + '<div class="wa-c-info">'
                  + '<div class="wa-c-cat">INSTANT DROP</div>'
                  + '<h2 class="wa-c-title">INSTANT ROLL PACK 100K</h2>'
                  + '<p class="wa-c-desc">Instantly grants and opens <b>100,000 card pulls</b> at once! Refreshes every <b>30 minutes</b>.</p>'
                  + '<div class="wa-c-mini"><b>100,000 PULLS</b> · INSTANT OPEN · 30:00 COOLDOWN</div>'
                + '</div>'
              + '</div>'
              + '<div class="wa-specs">'
                + '<div class="wa-spec hi"><k>PULL VOLUME</k><b>100,000</b></div>'
                + '<div class="wa-spec"><k>DELIVERY</k><b>INSTANT</b></div>'
                + '<div class="wa-spec"><k>COOLDOWN</k><b>30:00</b></div>'
              + '</div>'
              + '<div class="wa-stat-wrap">'
                + '<div id="waPackStatusWrap">' + packStatusHtml + '</div>'
                + '<div class="wa-pbar"><i id="waPackPbar" style="transform:scaleX(' + packRatio.toFixed(3) + ')"></i></div>'
              + '</div>'
              + '<button type="button" class="wa-cta' + (packOnCd ? ' is-cd' : '') + '" id="waBtnPack" onclick="triggerWatchAd(\'pack100k\')"' + ((packOnCd || _watchingAdBusy) ? ' disabled' : '') + '>'
                + ((packOnCd || _watchingAdBusy) ? lockSvg : playSvg) + '<span id="waBtnPackTxt">' + packBtnTxt + '</span>'
              + '</button>'
            + '</section>'
          + '</div>'

          + '<div class="wa-notes">'
            + '<div class="wa-note"><k>MULTIPLIER STACK</k><b>TOTAL LUCK × 2 (ALL SOURCES)</b></div>'
            + '<div class="wa-note"><k>PORTAL AD ENGINE</k><b>CRAZYGAMES SDK v3 · FALLBACK SIM</b></div>'
            + '<div class="wa-note"><k>STREAM AUDIO LOCK</k><b>AUTO-MUTES SFX DURING AD</b></div>'
          + '</div>'
        + '</div>'

        + '<aside class="wa-side">'
          + '<div class="wa-sec-h"><b>// BROADCAST MONITOR</b><span class="rule"></span><span class="tag">CH-07</span></div>'
          + '<div id="waDeskSlot">' + monHtml + '</div>'

          + '<div class="wa-telem">'
            + '<div class="wa-tel-h"><span>// LIVE TELEMETRY</span><b id="waTelAvail">' + availCount + ' / 2 READY</b></div>'
            + '<div class="wa-tel-row"><span>AD LUCK MULTIPLIER</span><b id="waTelLuck" class="' + (luckActive ? 'lk' : '') + '">' + (luckActive ? ('2× ACTIVE (' + fmtCountdown(luckMs) + ')') : '1× STANDBY') + '</b></div>'
            + '<div class="wa-tel-row"><span>100K PACK STATUS</span><b id="waTelPack" class="' + (packOnCd ? 'wr' : 'gd') + '">' + (packOnCd ? ('CD · ' + fmtCountdown(packMs)) : 'READY TO CLAIM') + '</b></div>'
            + '<div class="wa-tel-row"><span>SESSION CLAIMS</span><b id="waTelClaims">' + _watchAdsClaims + ' CLAIMED</b></div>'
          + '</div>'

          + '<div class="wa-rules">'
            + '<div class="wa-rules-h">// PROTOCOL BRIEFING</div>'
            + '<p><b>2× Luck Overdrive</b> multiplies your combined Luck across potions, weather, global shrine, and rebirth for <b>5:00</b>. Rewatch immediately once it expires.</p>'
            + '<p><b>Instant Roll Pack 100K</b> opens 100,000 pulls directly into your collection with a <b>30:00</b> cooldown between claims.</p>'
          + '</div>'
        + '</aside>'
      + '</div>'

      + '<footer class="wa-foot">'
        + '<span><b>WATCH AD</b> 5s sponsored feed</span>'
        + '<span><b>2× LUCK</b> stacks with potions &amp; weather</span>'
        + '<span class="haz">HZ-PROTOCOL // ADS</span>'
      + '</footer>'
    + '</div>';
}

function tickWatchAdsModal() {
  var luckMs = adLuckLeftMs();
  var packMs = adPackCdLeftMs();

  var lt = document.getElementById('waLuckTimer');
  var pt = document.getElementById('waPackTimer');
  var blTxt = document.getElementById('waBtnLuckTxt');
  var bpTxt = document.getElementById('waBtnPackTxt');
  var tsLuck = document.getElementById('waTsLuck');
  var telLuck = document.getElementById('waTelLuck');
  var telPack = document.getElementById('waTelPack');
  var lBar = document.getElementById('waLuckPbar');
  var pBar = document.getElementById('waPackPbar');

  /* Re-render full modal only when active/cooldown state flips */
  if ((lt && luckMs <= 0) || (!lt && luckMs > 0) || (pt && packMs <= 0) || (!pt && packMs > 0)) {
    renderWatchAdsModal();
    if (typeof renderShell === 'function') renderShell();
    return;
  }

  if (lt && luckMs > 0) lt.textContent = fmtCountdown(luckMs);
  if (blTxt && luckMs > 0) blTxt.textContent = 'ACTIVE · ' + fmtCountdown(luckMs);
  if (tsLuck && luckMs > 0) tsLuck.textContent = '2× · ' + fmtCountdown(luckMs);
  if (telLuck && luckMs > 0) telLuck.textContent = '2× ACTIVE (' + fmtCountdown(luckMs) + ')';
  if (lBar && luckMs > 0) {
    lBar.style.transform = 'scaleX(' + Math.max(0.02, Math.min(1, luckMs / AD_LUCK_DURATION_MS)).toFixed(3) + ')';
  }

  if (pt && packMs > 0) pt.textContent = fmtCountdown(packMs);
  if (bpTxt && packMs > 0) bpTxt.textContent = 'WAIT · ' + fmtCountdown(packMs);
  if (telPack && packMs > 0) telPack.textContent = 'CD · ' + fmtCountdown(packMs);
  if (pBar && packMs > 0) {
    pBar.style.transform = 'scaleX(' + Math.max(0.02, Math.min(1, 1 - (packMs / AD_PACK_COOLDOWN_MS))).toFixed(3) + ')';
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
    toast('BUFF STILL ACTIVE', 'Wait for the 5-minute duration to end before watching again.', '#fbbf24');
    return;
  }
  if (kind === 'pack100k' && adPackCdLeftMs() > 0) {
    toast('STILL ON COOLDOWN', 'Wait ' + fmtCountdown(adPackCdLeftMs()) + ' more to claim the 100K Pack.', '#fbbf24');
    return;
  }

  // 1. Primary: CrazyGames SDK v3 rewarded ad when running inside portal
  if (window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.ad) {
    try {
      _watchingAdBusy = true;
      var wasMuted = (typeof state !== 'undefined' && state && state.muted);
      var callbacks = {
        adStarted: function() {
          if (typeof state !== 'undefined' && state) state.muted = true;
        },
        adFinished: function() {
          if (typeof state !== 'undefined' && state) state.muted = wasMuted;
          _watchingAdBusy = false;
          completeWatchAdReward(kind);
        },
        adError: function(error) {
          if (typeof state !== 'undefined' && state) state.muted = wasMuted;
          _watchingAdBusy = false;
          console.warn("[CrazyGames Ad Error]", error);
          // Fallback to local timer simulation when portal ad fill is unavailable
          runWatchAdSimulation(kind);
        }
      };
      window.CrazyGames.SDK.ad.requestAd('rewarded', callbacks);
      return;
    } catch (err) {
      console.warn("[CrazyGames Ad requestAd exception]", err);
    }
  }

  // 2. Fallback: Local 5-second broadcast simulation (localhost / dev)
  runWatchAdSimulation(kind);
}
window.triggerWatchAd = triggerWatchAd;

function runWatchAdSimulation(kind) {
  if (_watchAdsSimTimer) { clearInterval(_watchAdsSimTimer); _watchAdsSimTimer = null; }
  if (_watchAdsDoneTimer) { clearTimeout(_watchAdsDoneTimer); _watchAdsDoneTimer = null; }
  _watchAdsDoneKind = null;

  var m = document.getElementById('watchAdsModal');
  var modalOpen = !!(m && m.classList.contains('show'));
  if (!modalOpen || kind === 'gems') {
    _watchingAdBusy = false;
    completeWatchAdReward(kind);
    return;
  }

  _watchingAdBusy = true;
  _watchAdsSimKind = kind;
  _watchAdsSimSecLeft = AD_WATCH_SIM_SEC;
  renderWatchAdsModal();

  _watchAdsSimTimer = setInterval(function() {
    _watchAdsSimSecLeft--;
    if (_watchAdsSimSecLeft > 0) {
      renderWatchAdsModal();
    } else {
      clearInterval(_watchAdsSimTimer);
      _watchAdsSimTimer = null;
      _watchingAdBusy = false;
      _watchAdsSimKind = null;
      completeWatchAdReward(kind);
    }
  }, 1000);
}

function completeWatchAdReward(kind) {
  var now = Date.now();
  _watchAdsClaims++;
  if (kind === 'luck') {
    _saveAdState(now + AD_LUCK_DURATION_MS, null);
    _watchAdsDoneKind = 'luck';
    try { if (typeof sfx !== 'undefined' && sfx.win) sfx.win(); } catch (e) {}
    toast('2× LUCK ACTIVE (5 MIN)!', 'Your total luck is doubled (×2) for 5 minutes!', '#6be08a');
    renderWatchAdsModal();
    if (typeof renderShell === 'function') renderShell();
    if (typeof renderLobby === 'function' && typeof route === 'function' && route() === '#/lobby' && !battleLive()) {
      var lbl = document.getElementById('hfdAdsLbl');
      if (lbl) lbl.textContent = '2× ON';
    }
    if (_watchAdsDoneTimer) clearTimeout(_watchAdsDoneTimer);
    _watchAdsDoneTimer = setTimeout(function() {
      _watchAdsDoneKind = null;
      var m = document.getElementById('watchAdsModal');
      if (m && m.classList.contains('show') && !_watchingAdBusy) renderWatchAdsModal();
    }, 2400);
  } else if (kind === 'pack100k') {
    _saveAdState(null, now + AD_PACK_COOLDOWN_MS);
    _watchAdsDoneKind = null;
    try { if (typeof sfx !== 'undefined' && sfx.win) sfx.win(); } catch (e) {}
    renderWatchAdsModal();
    var pulls = 100000;
    var loot = (typeof instantRollFast === 'function') ? instantRollFast(pulls, true) : [];
    toast('INSTANT PACK 100K RECEIVED!', '100,000 instant card pulls opened!', '#ffd700');
    if (typeof renderShell === 'function') renderShell();
    closeWatchAdsModal(function() {
      if (typeof showTowerLoot === 'function') {
        showTowerLoot(loot, { weather: 0, luck: 0, speed: 0 }, 'REWARD WATCH ADS · 100,000 ROLL');
      }
    });
  } else if (kind === 'gems') {
    if (typeof state !== 'undefined' && state) {
      state.premiumGems = (state.premiumGems || 0) + 25;
      if (typeof save === 'function') save();
    }
    try { if (typeof sfx !== 'undefined' && sfx.win) sfx.win(); } catch (e) {}
    toast('FREE REWARD CLAIMED!', '+25 GEMS RECEIVED FROM CRAZYGAMES REWARD!', '#7df9ff');
    if (typeof renderPremiumShop === 'function') renderPremiumShop();
    if (typeof renderShell === 'function') renderShell();
  }
}


