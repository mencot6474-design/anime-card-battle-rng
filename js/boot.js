/* =============== SETTINGS =============== */
function renderSettings(){
  /* BATTLE SPEED: clamp ke unlock level sebelum render panel */
  if(typeof state.battleSpeed!=="number"||state.battleSpeed<1||state.battleSpeed>4)state.battleSpeed=1;
  {const _m=battleSpeedMax();if(state.battleSpeed>_m)state.battleSpeed=_m;}
  app.innerHTML=`
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;background:linear-gradient(135deg,rgba(31,40,51,0.7),rgba(15,20,28,0.85));padding:14px 20px;border-radius:14px;border:1px solid rgba(102,252,241,0.2);box-shadow:0 8px 32px rgba(0,0,0,0.4);backdrop-filter:blur(8px)">
    <div>
      <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:var(--cyan,#66fcf1);text-transform:uppercase">SYSTEM CONFIGURATION</div>
      <h1 style="margin:2px 0 0;font-size:26px;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px;color:#fff">GAME <span style="background:linear-gradient(90deg,#66fcf1,#c56cf0);-webkit-background-clip:text;-webkit-text-fill-color:transparent">SETTINGS</span></h1>
    </div>
    <button onclick="location.hash='#/lobby';render();" style="display:flex;align-items:center;gap:8px;padding:10px 22px;font-size:13px;font-weight:800;letter-spacing:1px;background:linear-gradient(135deg,#c56cf0,#7d5fff);color:#fff;border:none;border-radius:10px;cursor:pointer;box-shadow:0 4px 18px rgba(125,95,255,0.4);transition:all .2s ease">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg> KEMBALI KE LOBBY
    </button>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">
    
    <!-- BATTLE SPEED -->
    <div class="panel set-panel" style="background:linear-gradient(145deg,rgba(15,25,35,0.85),rgba(10,15,22,0.95));border:1px solid rgba(102,252,241,0.25);border-radius:14px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,0.3)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="background:rgba(102,252,241,0.15);color:#66fcf1;font-size:10px;font-weight:900;padding:3px 8px;border-radius:6px;border:1px solid rgba(102,252,241,0.3)">COMBAT</span>
        <div class="set-t" style="margin:0;color:#f1f2f6;font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#66fcf1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> BATTLE SPEED
        </div>
      </div>
      <div class="set-d" style="color:#a4b0be;font-size:12px;line-height:1.4;margin-bottom:14px">Kecepatan aksi & giliran: <b style="color:#66fcf1">2× di LV 25</b> · <b style="color:#66fcf1">3× di LV 50</b> · <b style="color:#66fcf1">4× di LV 100</b>.</div>
      <div class="gm-row" id="bsRow" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">${[1,2,3,4].map(n=>{const lk=n>battleSpeedMax();return `<button class="gm-btn bs-btn${(!lk&&n===state.battleSpeed)?" bs-on":""}" data-sp="${n}"${lk?" disabled":""} style="padding:10px 4px;font-size:13px;font-weight:800;border-radius:8px;border:1px solid ${(!lk&&n===state.battleSpeed)?'#66fcf1':'rgba(255,255,255,0.1)'};background:${(!lk&&n===state.battleSpeed)?'linear-gradient(135deg,rgba(102,252,241,0.25),rgba(125,95,255,0.3))':'rgba(255,255,255,0.05)'};color:${lk?'#57606f':'#fff'}">${n}×</button>`;}).join("")}</div>
      <div class="gm-note" id="bsNote" style="color:#a4b0be;font-size:11px;font-weight:600"></div>
    </div>

    <!-- AUDIO -->
    <div class="panel set-panel" style="background:linear-gradient(145deg,rgba(30,26,16,0.85),rgba(18,15,10,0.95));border:1px solid rgba(255,209,102,0.25);border-radius:14px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,0.3)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="background:rgba(255,209,102,0.15);color:#ffd166;font-size:10px;font-weight:900;padding:3px 8px;border-radius:6px;border:1px solid rgba(255,209,102,0.3)">AUDIO</span>
        <div class="set-t" style="margin:0;color:#f1f2f6;font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffd166" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> SOUND DIAGNOSTIC
        </div>
      </div>
      <div class="set-d" style="color:#a4b0be;font-size:12px;line-height:1.4;margin-bottom:12px">Kalau battle terasa hening, cek status di bawah lalu tekan tes nada.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <button class="gm-btn" id="audToggle" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;font-weight:700;border-radius:8px;padding:8px">SUARA: -</button>
        <button class="gm-btn" id="audTone" style="background:linear-gradient(135deg,#2ed573,#1e90ff);color:#fff;font-weight:700;border:none;border-radius:8px;padding:8px">TES NADA</button>
      </div>
      <button class="gm-btn" id="audHit" style="width:100%;background:linear-gradient(135deg,#ff4757,#ffa502);color:#fff;font-weight:700;border:none;border-radius:8px;padding:8px;margin-bottom:10px">TES SFX RAID (HIT + DENTUMAN)</button>
      <div class="gm-note" id="audStat" style="color:#ffd166;font-weight:600;font-size:11px;line-height:1.5"></div>
    </div>

    <!-- TOWER & AKUN -->
    <div class="panel set-panel" style="background:linear-gradient(145deg,rgba(18,22,30,0.85),rgba(12,15,20,0.95));border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,0.3)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="background:rgba(255,165,2,0.15);color:#ffa502;font-size:10px;font-weight:900;padding:3px 8px;border-radius:6px;border:1px solid rgba(255,165,2,0.3)">SYSTEM</span>
        <div class="set-t" style="margin:0;color:#f1f2f6;font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffa502" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> INFINITE TOWER & CLOUD
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;margin-bottom:14px">
        <label class="gm-check" style="color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="setAutoTower"> AUTO RESTART DARI LANTAI 1
        </label>
        <div class="gm-note" id="towerSetNote" style="color:#747d8c;font-size:11px;margin-top:4px"></div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(102,252,241,0.05);border:1px solid rgba(102,252,241,0.2);padding:12px;border-radius:10px;margin-bottom:14px">
        <div>
          <div style="font-size:11px;color:#747d8c;font-weight:700">USER PROFILE</div>
          <div style="font-size:15px;color:#66fcf1;font-weight:800">${currentUser||"-"}</div>
        </div>
        <button class="reset-btn" id="logoutBtn" style="margin:0;padding:8px 14px;font-size:12px;font-weight:700;color:#fff;background:rgba(255,71,87,0.2);border:1px solid rgba(255,71,87,0.4);border-radius:8px;cursor:pointer">Keluar Akun</button>
      </div>

      <div>
        <button class="reset-btn" id="resetBtn" style="width:100%;padding:10px;font-size:12px;font-weight:800;letter-spacing:1px;background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.3);color:#ff4757;border-radius:8px;cursor:pointer">RESET DATA LOKAL</button>
      </div>
    </div>

  </div>`;
  if(window.lucide) window.lucide.createIcons();
  document.getElementById("logoutBtn").onclick=logout;
  /* Auto restart Tower Infinite — flag di state.tower.auto (default mati). */
  if(!state.tower)state.tower={best:0};
  const autoCb=document.getElementById("setAutoTower"),towerSetNote=document.getElementById("towerSetNote");
  const towerSetMsg=()=>{towerSetNote.textContent=autoCb.checked?"AUTO RESTART AKTIF — kalah = langsung mulai run baru dari Lantai 1.":"Auto restart mati — kalah = kembali ke menu Tower.";};
  autoCb.checked=state.tower.auto===true;
  towerSetMsg();
  autoCb.onchange=()=>{state.tower.auto=autoCb.checked;save();towerSetMsg();};
  /* BATTLE SPEED — pilihan 1x-4x; 2x/3x/4x terkunci level 10/25/50. */
  const bsNote=document.getElementById("bsNote");
  const bsMsg=()=>{const _m=battleSpeedMax();bsNote.textContent="LEVEL KAMU: "+(state.playerLv||1)+" · SPEED AKTIF: "+state.battleSpeed+"×"+(_m<4?" · Berikutnya terbuka di LV "+(_m===1?10:_m===2?25:50):" · SUDAH MAX");};
  bsMsg();
  document.querySelectorAll("#bsRow .bs-btn").forEach(el=>{el.onclick=()=>{const n=parseInt(el.getAttribute("data-sp"),10);if(!n||n>battleSpeedMax())return;state.battleSpeed=n;save();renderSettings();};});
  /* AUDIO — status live + toggle mute + tes nada. Diagnosa kalau battle hening di perangkat. */
  {
    const audStat=document.getElementById("audStat"),audToggle=document.getElementById("audToggle");
    if(audStat&&audToggle){
      const ctxState=()=>{try{return (typeof actx!=="undefined"&&actx)?actx.state:"belum dibuat";}catch(e){return "?";}};
      let sayUntil=0;
      const say=t=>{sayUntil=Date.now()+4000;audStat.textContent=t;};
      const paint=()=>{
        if(Date.now()<sayUntil)return;
        audToggle.textContent="SUARA: "+(state.muted?"MATI":"NYALA");
        audStat.textContent="AudioContext: "+ctxState()+" · SFX: "+(state.muted?"MATI":"NYALA")+" · unlocker: "+((window.__aabAudioUnlockers||[]).length);
      };
      paint();
      const iv=setInterval(()=>{if(!document.body.contains(audStat)){clearInterval(iv);return;}paint();},1000);
      audToggle.onclick=()=>{state.muted=!state.muted;save();paint();if(!state.muted){try{unlockGameAudio();if(window.CyberSfx)window.CyberSfx.katanaSlash(1);}catch(e){}}};
      document.getElementById("audTone").onclick=()=>{
        try{
          unlockGameAudio();
          const c=actxOf(),o=c.createOscillator(),g=c.createGain();
          o.type="sine";o.frequency.value=440;g.gain.value=0.25;
          o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+0.8);
          say("Nada 440Hz diputar · AudioContext: "+c.state);
        }catch(e){say("Nada GAGAL: "+e.message);}
      };
      document.getElementById("audHit").onclick=()=>{
        if(state.muted){say("SFX sedang MATI — tekan SUARA dulu.");return;}
        try{
          unlockGameAudio();
          if(!window.CyberSfx){say("CyberSfx tidak termuat");return;}
          window.CyberSfx.katanaSlash(1);
          setTimeout(()=>{try{if(window.CyberSfx)window.CyberSfx.aoeDetonate();}catch(e){}},260);
          say("SFX raid diputar · AudioContext: "+ctxState());
        }catch(e){say("SFX GAGAL: "+e.message);}
      };
    }
  }
  let armed=false,timer=null;
  const b=document.getElementById("resetBtn");
  const disarm=()=>{armed=false;if(timer){clearTimeout(timer);timer=null;}b.classList.remove("armed");b.textContent="Reset Semua & Main Dari Awal";};
  b.onclick=()=>{
    if(!armed){armed=true;b.classList.add("armed");b.textContent="Yakin? Tap lagi untuk reset";timer=setTimeout(disarm,4000);}
    else{localStorage.removeItem(KEY);location.reload();}
  };
}

/* =============== ROUTER =============== */
/* Jangan biarkan browser restore posisi scroll lama pas back/forward/refresh. */
try{ if("scrollRestoration" in history ) history.scrollRestoration="manual"; }catch(e){}
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
    const hasBattle = !!state.battle || !!app.querySelector(".battle-grid");
    const onTower = !hasBattle && !!app.querySelector(".tw-page:not(.rd-page)");
    const onRaid = !hasBattle && !!app.querySelector(".rd-page");
    document.body.classList.toggle("on-lobby", !hasBattle && !!app.querySelector(".lobby-hub"));
    document.body.classList.toggle("on-tower", onTower);
    document.body.classList.toggle("on-raid", onRaid);
    document.documentElement.classList.toggle("on-tower-root", onTower);
    /* Class tambahan di <html>: kunci scroll tanpa :has() (WebView APK lama bisa nggak support). */
    document.documentElement.classList.toggle("view-locked", hasBattle||!!app.querySelector(".lobby-hub")||onTower||onRaid);
    /* Reset scroll dokumen tiap ganti view — sisa scroll lama jangan bocor
       ke view baru (efek "nempel ke topbar" di lobby/raid/battle). */
    window.scrollTo(0,0);
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
  // Tinggi topbar asli → --tbh cuma pas battle (v34 revert). Lobby sengaja pakai default 64px
  // biar geometri main calc(100dvh - 64) balik persis ke state v31 yang center-nya pas;
  // sisa potensi ke-scroll sudah dikunci di CSS: html:has(body.on-lobby){overflow:hidden}.
  const tb=document.getElementById("topbar"); if(hasBattle && tb) document.documentElement.style.setProperty("--tbh", Math.round(tb.getBoundingClientRect().height)+"px");
  // Tombol END khusus Infinite Tower; story & raid boss auto-complete jadi nggak perlu tombol.
  document.body.classList.toggle("battle-tower", !!(grid && grid.classList.contains("tower-stage")));
  document.body.classList.toggle("battle-raid", !!(grid && grid.classList.contains("raid-stage")));
  const onTower = !hasBattle && !!app.querySelector(".tw-page:not(.rd-page)");
  const onRaid = !hasBattle && !!app.querySelector(".rd-page");
  document.body.classList.toggle("on-lobby", !hasBattle && !!app.querySelector(".lobby-hub"));
  document.body.classList.toggle("on-tower", onTower);
  document.body.classList.toggle("on-raid", onRaid);
  document.documentElement.classList.toggle("on-tower-root", onTower);
  document.documentElement.classList.toggle("view-locked", hasBattle||!!app.querySelector(".lobby-hub")||onTower||onRaid);
  /* Safety: dokumen selalu di posisi paling atas (observer ini jalan di luar render()). */
  if(window.scrollX||window.scrollY) window.scrollTo(0,0);
};
/* Pin scrollY=0 selama battle — WebView APK suka auto-scroll ke tombol yang di-tap
   di tengah battle → layer fixed (#dmgLayer/canvas VFX) meleset dari kartunya. */
window.addEventListener("scroll",()=>{
  if(document.body&&document.body.classList.contains("battle-full")&&window.scrollY)window.scrollTo(0,0);
},{passive:true});
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
  const fav=document.getElementById("footAv");if(fav){fav.onclick=function(e){e.stopPropagation();toggleFootMenu();};}
  document.addEventListener("click",e=>{
    const fm=document.getElementById("footMenu");
    if(!fm||!fm.classList.contains("show"))return;
    if(!e.target.closest("#footMenu")&&!e.target.closest("#footAv"))closeFootMenu();
  });
  const bd=document.getElementById("profBackdrop");if(bd)bd.onclick=closeProfileModal;
  const pc=document.getElementById("profClose");if(pc)pc.onclick=function(e){e.stopPropagation();closeProfileModal();};
  /* AUTO: toggle rolling terus-menerus. Klik lagi / Tutup / klik dadu = mati. */
  const ra=document.getElementById("rollAutoBtn");
  if(ra)ra.addEventListener("click",()=>{
    if(rollState.active){stopRollAnimation();hideRollResult();beep(330,0.12,"square",0.08);}
    else{startRollAnimation();beep(440,0.15,"sine",0.1);}
  });
  /* Sembunyikan lewat kontrol "Sembunyikan" atau klik area gelap di LUAR kartu — kartu sendiri (area badge/chance) tidak menyembunyikan. Auto roll tetap berjalan di background. */
  const rov=document.getElementById("rollOverlay");
  if(rov)rov.addEventListener("click",e=>{
    if(e.target===rov||e.target.closest("#rollCloseBtn")||e.target.closest(".roll-hide-btn")){hideRollResult();beep(330,0.12,"square",0.08);}
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
window.addEventListener("hashchange",()=>{
  stopBattleLoop();
  stopRaid();
  stopTower();
  if(route()!=="#/"){
    state.battle=null;
    
  }
  closeStory();
  render();
});

/* =============== AUTH + BOOT =============== */
let authMode="login";
function setAuthMode(m){
  authMode=m;
  document.getElementById("tabLogin").classList.toggle("active",m==="login");
  document.getElementById("tabRegister").classList.toggle("active",m==="register");
  document.getElementById("auSubmit").textContent=m==="login"?"MASUK":"DAFTAR";
  document.getElementById("auErr").textContent="";
  /* layar login cyber: brand pane flip ke kanan saat mode daftar */
  var card=document.getElementById("auCard"); if(card) card.classList.toggle("flip",m==="register");
  var hd=document.getElementById("hdMode"); if(hd) hd.textContent=m==="login"?"Hunter Login":"Hunter Register";
  var tg=document.getElementById("brandTag");
  if(tg) tg.innerHTML=m==="login"
    ? 'Masuk untuk melanjutkan <b>perjalananmu</b> menaklukkan arena dan membangun shadow army.'
    : 'Daftar untuk <b>terbangun sebagai Player</b> — progresmu langsung tersimpan di Cloud.';
}
function auError(msg){document.getElementById("auErr").textContent=msg;}
/* Layer ambient layar login: titik cyan naik (dipakai di prototipe;
   belum ke-port di Unit A/B, jadi ditambahkan Unit C). Dipanggil sekali. */
function spawnLoginParticles(n){
  n=n||18;
  const w=document.getElementById("acParts");
  if(!w||w.childElementCount) return;
  const frag=document.createDocumentFragment();
  for(let i=0;i<n;i++){
    const p=document.createElement("div");
    p.className="ac-pt";
    p.style.left=(Math.random()*100)+"%";
    p.style.bottom="-6px";
    p.style.animationDuration=(6+Math.random()*7).toFixed(2)+"s";
    p.style.animationDelay=(-Math.random()*7).toFixed(2)+"s"; /* negatif: langsung tersebar, tak kosong di menit awal */
    frag.appendChild(p);
  }
  w.appendChild(frag);
}
async function submitAuth(){
  const btn=document.getElementById("auSubmit");
  const name=document.getElementById("auUser").value.trim();
  const pass=document.getElementById("auPass").value;
  auError("");
  if(name.length<3){auError("Username minimal 3 karakter.");return;}
  if(/\s/.test(name)){auError("Username tidak boleh ada spasi.");return;}
  if(pass.length<3){auError("Password minimal 3 karakter.");return;}
  btn.disabled=true;btn.classList.add("press");
  document.getElementById("asTxt").textContent=authMode==="register"?"Mendaftarkan ke Cloud…":"Menghubungkan ke Cloud…";
  document.getElementById("authSpin").classList.remove("hidden");

  const finish=()=>{document.getElementById("authSpin").classList.add("hidden");btn.disabled=false;btn.classList.remove("press");};
  const users=getUsers(), key=name.toLowerCase(), passH=hashPass(pass);

  /* 1. Identitas cloud. Login: jalur Auth (JWT) dulu — signIn = bukti password,
     lalu save dibaca lewat token (0020). Pemain lama yang belum punya akun Auth
     diverifikasi lewat RPC check_credentials (definer), lalu sesi dibuat +
     uid ditautkan. Anon tidak lagi dipakai sebagai bukti "akun ada" (2c). */
  let cloudUser=null, cloudOk=false;
  if(window.CloudDB){
    if(authMode==="register"){
      try {
        cloudUser = await window.CloudDB.getUser(key);
      } catch(err){ console.warn("Cloud lookup err:", err); }
    }else{
      const jwt = window.CloudAuth ? await window.CloudAuth.authenticate(key, passH) : null;
      if(jwt && jwt.ok){
        cloudOk=true;
        cloudUser={username:jwt.username, save_data:jwt.save_data};
      }else{
        let chk=null;
        try { chk = await window.CloudDB.checkCredentials(key, passH); }
        catch(err){ console.warn("checkCredentials err:", err); }
        if(chk && chk.ok){
          cloudOk=true;
          /* Ditautkan dulu (bukan tembak-lari): enterGame langsung membaca save lewat JWT. */
          if(window.CloudAuth){
            try { await window.CloudAuth.connect(key, passH); }
            catch(err){ console.warn("Auth connect err:", err); }
          }
        }
      }
    }
  }

  if(authMode==="register"){
    if(users[key] || cloudUser){
      auError("Username itu sudah dipakai. Coba masuk.");
      finish();
      return;
    }
    // Register lokal
    users[key]={name,pass:passH,created:Date.now()};
    saveUsers(users);

    // Register Cloud
    const initSt = freshState();
    if(window.CloudDB){
      try {
        await window.CloudDB.registerUser(name, passH, initSt);
      } catch(err){ console.warn("Cloud register fail:", err); }
    }
    /* Fase 1 JWT: bikin akun Auth untuk user baru (tidak memblokir UI). */
    if(window.CloudAuth) window.CloudAuth.kick(name);

    finish();
    document.getElementById("auPass").value="";
    document.getElementById("adTitle").textContent="Akun berhasil dibuat";
    document.getElementById("adMsg").textContent="Silakan masuk sebagai "+name+". Tersimpan di Cloud!";
    document.getElementById("authDone").classList.remove("hidden");
  }else{
    // Mode LOGIN: prioritas cloud, fallback lokal
    if(cloudOk){
      const targetName = name;
      users[key] = {name: targetName, pass: passH, created: Date.now()};
      saveUsers(users);
      if(window.CloudAuth) window.CloudAuth.kick(targetName);
      if(cloudUser && cloudUser.save_data){
        try {
          localStorage.setItem("aab-state-v2:"+targetName, JSON.stringify(cloudUser.save_data));
        }catch(e){}
      }
      finish();
      enterGame(targetName, true);
    }else{
      // Fallback lokal (akun lama yang belum/gagal sync ke cloud)
      const u = users[key];
      if(!u){
        auError("Akun belum terdaftar. Silakan daftar dulu.");
        finish();
        return;
      }
      if(u.pass!==passH){
        auError("Password salah.");
        finish();
        return;
      }
      if(window.CloudAuth) window.CloudAuth.kick(u.name || name);
      finish();
      enterGame(u.name || name, true);
    }
  }
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
function showWelcomeWindow(name){
  const wm=document.getElementById("welcomeModal");
  const nm=document.getElementById("wlName");
  if(nm) nm.textContent=(name||"Hunter").toUpperCase();
  const lv=document.getElementById("wlLvl");
  if(lv) lv.textContent=""+(state&&state.playerLv?state.playerLv:1);
  const pw=document.getElementById("wlPw");
  if(pw){ try{ pw.textContent=(typeof totalPower==="function")?fmt(totalPower()):"0"; }catch(e){ pw.textContent="0"; } }
  const parts=document.getElementById("wlParts");
  if(parts&&!parts.childElementCount){
    for(let i=0;i<18;i++){const p=document.createElement("div");p.className="pt";
      p.style.left=(Math.random()*100).toFixed(1)+"%";
      p.style.animationDuration=(6+Math.random()*7).toFixed(2)+"s";
      p.style.animationDelay=(-Math.random()*7).toFixed(2)+"s";
      parts.appendChild(p);}
  }
  wm.classList.remove("hidden");
  /* putar ulang animasi materi tiap masuk */
  const win=document.getElementById("wlWin");
  if(win){ win.style.animation="none"; void win.offsetWidth; win.style.animation=""; }
}
async function enterGame(name,welcome){
  currentUser=name;
  localStorage.setItem(SESSION_KEY,name);
  /* Fase 1 JWT: sesi Auth ikut dipulihkan saat auto-login (password asli
     tidak ada di sini, jadi CloudAuth memakai hash lokal + refresh token). */
  if(window.CloudAuth) window.CloudAuth.kick(name);
  if(window.CloudDB && window.CURRENT_DEVICE_SESSION){
    window.CloudDB.updateSession(name, window.CURRENT_DEVICE_SESSION).catch(()=>{});
    if(window.startSessionHeartbeat) window.startSessionHeartbeat(name);
  }
  
  // Sinkronisasi data cloud terbaru saat masuk game
  if(window.CloudDB){
    try {
      const cUser = await window.CloudDB.getUser(name);
      if(cUser && cUser.save_data){
        localStorage.setItem("aab-state-v2:" + name, JSON.stringify(cUser.save_data));
      }
    } catch(err){ console.warn("Cloud pull fail on enterGame:", err); }
  }

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
        showWelcomeWindow(name);
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
  const pctEl=document.getElementById("ldPct");
  scr.classList.remove("hidden");
  /* Hologram kartu aktif = sama seperti card lobby (pakai hubCardHtml yang
     sama). Fallback ke emblem spiral kalau belum ada kartu / render gagal. */
  const holo=scr.querySelector(".ld-holo");
  const cardBox=document.getElementById("ldCard");
  if(cardBox){
    cardBox.innerHTML="";
    try{
      const eq=(typeof equipped==="function")?equipped():null;
      if(eq&&eq.char&&typeof hubCardHtml==="function"){
        cardBox.innerHTML=hubCardHtml(eq);
        if(holo) holo.classList.add("has-card");
      } else if(holo){ holo.classList.remove("has-card"); }
    }catch(e){ if(holo) holo.classList.remove("has-card"); }
  }
  const steps=["Menyinkronkan data…","Membangun deck…","Menyiapkan arena…","Memuat dunia…","Siarp!"];
  const dur=3000,t0=Date.now();
  fill.style.width="0%";
  if(pctEl) pctEl.textContent="0%";
  let completed=false;
  const iv=setInterval(()=>{
    const p=Math.min(1,(Date.now()-t0)/dur);
    fill.style.width=(p*100).toFixed(1)+"%";
    if(pctEl) pctEl.textContent=Math.round(p*100)+"%";
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
/* ---- Menu dock (tombol kiri footer) ---- */
function toggleFootMenu(){
  const m=document.getElementById("footMenu");if(!m)return;
  m.classList.toggle("show");
}
function closeFootMenu(){
  const m=document.getElementById("footMenu");if(m)m.classList.remove("show");
}
function footMenuGo(k){
  closeFootMenu();
  if(k==="profile")openProfileModal();
  else if(k==="titles")openTitlesModal();
  else if(k==="backpack")toggleBackpack();
  else if(k==="premium")openPremiumShop();
  else if(k==="settings")location.hash="#/settings";
  else if(k==="logout"){if(confirm("Keluar dari akun ini?"))logout();}
}
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape")return;
  const m=document.getElementById("profModal");
  if(m&&(m.classList.contains("show")||m.style.display==="flex"))closeProfileModal();
});
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
  spawnLoginParticles();
  
  /* ========== Roll + Deck badge init ========== */
  rollCountBadge();
  if(window.videoBoot) window.videoBoot();

  /* ========== Cyberpunk Avatar Gallery Upload Listener ========== */
  const fi = document.getElementById("avFileInput");
  if(fi){
    fi.addEventListener("change", (e)=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      if(!file.type.startsWith("image/")){
        if(typeof toast==="function") toast("ERROR", "HANYA FILE GAMBAR YANG DIPERBOLEHKAN", "#ff4757");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev)=>{
        const img = new Image();
        img.onload = ()=>{
          const cv = document.createElement("canvas");
          const size = 96; // avatar: cukup untuk podium leaderboard (±106px) tanpa membesar-besarkan save
          cv.width = size; cv.height = size;
          const ctx = cv.getContext("2d");
          // center crop aspect ratio
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          /* WebP dulu (±5 KB), fallback ke JPEG kalau browser tidak mendukung —
             toDataURL balikin PNG kalau tipe yang diminta tidak dikenal. */
          const webp = cv.toDataURL("image/webp", 0.75);
          state.customAvatar = webp.indexOf("data:image/webp") === 0 ? webp : cv.toDataURL("image/jpeg", 0.78);
          save();
          renderShell();
          if(typeof toast==="function") toast("AVATAR UPDATED", "FOTO PROFIL BERHASIL DIUPDATE!", "#7df9ff");
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* Diagnosa: build + viewport nyata HP (tampil di semua layar) */
  (function(){
    const d=document.createElement("div");
    const upd=()=>{const a=(typeof actx!=="undefined"&&actx)?actx.state:"-";d.textContent="BUILD 2026-10-23-perf14-skfx · VP "+window.innerWidth+"×"+window.innerHeight+" · AUD "+a+((typeof state!=="undefined"&&state&&state.muted)?" MUTE":"");};
    d.style.cssText="position:fixed;left:6px;bottom:6px;z-index:999999;font:10px monospace;color:#7cf;opacity:.8;pointer-events:none;text-shadow:0 1px 2px #000";
    upd();
    window.addEventListener("resize",upd);
    window.addEventListener("fullscreenchange",upd);
    setInterval(upd,1500);
    document.body.appendChild(d);
  })();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
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
