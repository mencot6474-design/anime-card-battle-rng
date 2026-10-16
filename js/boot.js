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
    <button class="reset-btn" id="resetBtn">Reset Semua &amp; Main Dari Awal</button><div class="gm-note" style="text-align:center;opacity:.7;margin-top:10px">BUILD 68bfcb1 · VIEWPORT 1080</div>
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
  /* Diagnosa: build + viewport nyata HP (tampil di semua layar) */
  (function(){
    const d=document.createElement("div");
    const upd=()=>{d.textContent="BUILD 68bfcb1 · VP "+window.innerWidth+"×"+window.innerHeight;};
    d.style.cssText="position:fixed;left:6px;bottom:6px;z-index:999999;font:10px monospace;color:#7cf;opacity:.8;pointer-events:none;text-shadow:0 1px 2px #000";
    upd();
    window.addEventListener("resize",upd);
    document.body.appendChild(d);
  })();
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
