/* =============== SETTINGS =============== */
function renderSettings(){
  /* BATTLE SPEED: clamp ke unlock level sebelum render panel */
  if(typeof state.battleSpeed!=="number"||state.battleSpeed<1||state.battleSpeed>4)state.battleSpeed=1;
  {const _m=battleSpeedMax();if(state.battleSpeed>_m)state.battleSpeed=_m;}
  const curLang = (window.GameLang && typeof window.GameLang.get === "function") ? window.GameLang.get() : (state.lang || "id");
  const isEn = curLang === "en";
  app.innerHTML=`
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;background:linear-gradient(135deg,rgba(31,40,51,0.7),rgba(15,20,28,0.85));padding:14px 20px;border-radius:14px;border:1px solid rgba(102,252,241,0.2);box-shadow:0 8px 32px rgba(0,0,0,0.4);backdrop-filter:blur(8px)">
    <div>
      <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:var(--cyan,#66fcf1);text-transform:uppercase">SYSTEM CONFIGURATION</div>
      <h1 style="margin:2px 0 0;font-size:26px;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px;color:#fff">GAME <span style="background:linear-gradient(90deg,#66fcf1,#c56cf0);-webkit-background-clip:text;-webkit-text-fill-color:transparent">SETTINGS</span></h1>
    </div>
    <button onclick="location.hash='#/lobby';render();" style="display:flex;align-items:center;gap:8px;padding:10px 22px;font-size:13px;font-weight:800;letter-spacing:1px;background:linear-gradient(135deg,#c56cf0,#7d5fff);color:#fff;border:none;border-radius:10px;cursor:pointer;box-shadow:0 4px 18px rgba(125,95,255,0.4);transition:all .2s ease">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg> ${isEn ? "BACK TO LOBBY" : "KEMBALI KE LOBBY"}
    </button>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">

    <!-- LANGUAGE / BAHASA -->
    <div class="panel set-panel" style="background:linear-gradient(145deg,rgba(18,16,36,0.88),rgba(10,12,24,0.96));border:1px solid rgba(197,108,240,0.35);border-radius:14px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,0.35)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="background:rgba(197,108,240,0.16);color:#e9d5ff;font-size:10px;font-weight:900;padding:3px 8px;border-radius:6px;border:1px solid rgba(197,108,240,0.38)">LOCALE</span>
        <div class="set-t" style="margin:0;color:#f1f2f6;font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c56cf0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> ${isEn ? "LANGUAGE / BAHASA" : "BAHASA / LANGUAGE"}
        </div>
      </div>
      <div class="set-d" style="color:#a4b0be;font-size:12px;line-height:1.4;margin-bottom:14px">${isEn ? "Select the game interface display language (saved automatically)." : "Pilih bahasa tampilan antarmuka game (tersimpan otomatis)."}</div>
      <div id="langRow" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <button type="button" class="gm-btn lang-btn${!isEn ? " lang-on" : ""}" data-lang="id" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 10px;font-size:13px;font-weight:800;border-radius:10px;cursor:pointer;border:1px solid ${!isEn ? "#66fcf1" : "rgba(255,255,255,0.12)"};background:${!isEn ? "linear-gradient(135deg,rgba(102,252,241,0.22),rgba(197,108,240,0.28))" : "rgba(255,255,255,0.05)"};color:${!isEn ? "#fff" : "#a4b0be"};box-shadow:${!isEn ? "0 0 16px rgba(102,252,241,0.22)" : "none"}">
          <span style="font-size:16px;line-height:1">🇮🇩</span>
          <span>INDONESIA</span>
        </button>
        <button type="button" class="gm-btn lang-btn${isEn ? " lang-on" : ""}" data-lang="en" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 10px;font-size:13px;font-weight:800;border-radius:10px;cursor:pointer;border:1px solid ${isEn ? "#66fcf1" : "rgba(255,255,255,0.12)"};background:${isEn ? "linear-gradient(135deg,rgba(102,252,241,0.22),rgba(197,108,240,0.28))" : "rgba(255,255,255,0.05)"};color:${isEn ? "#fff" : "#a4b0be"};box-shadow:${isEn ? "0 0 16px rgba(102,252,241,0.22)" : "none"}">
          <span style="font-size:16px;line-height:1">🇬🇧</span>
          <span>ENGLISH</span>
        </button>
      </div>
      <div class="gm-note" style="color:#c56cf0;font-size:11px;font-weight:700">${isEn ? "ACTIVE LANGUAGE: ENGLISH (EN)" : "BAHASA AKTIF: INDONESIA (ID)"}</div>
    </div>
    
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

      <div style="background:rgba(102,252,241,0.04);border:1px solid rgba(102,252,241,0.25);border-radius:10px;padding:12px;margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div>
            <div style="font-size:12px;font-weight:800;color:#66fcf1;display:flex;align-items:center;gap:6px">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
              ${isEn ? "CLOUD SYNC" : "SINKRONISASI CLOUD"}
            </div>
            <div id="cloudSyncNote" style="font-size:11px;color:#a4b0be;margin-top:2px">
              ${isEn ? "Save all cards & inventory to Supabase immediately." : "Simpan semua kartu & backpack langsung ke Supabase."}
            </div>
          </div>
        </div>
        <button id="manualCloudBtn" type="button" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;font-size:12px;font-weight:800;letter-spacing:1px;background:linear-gradient(135deg,rgba(102,252,241,0.2),rgba(32,191,107,0.25));border:1px solid rgba(102,252,241,0.5);color:#66fcf1;border-radius:8px;cursor:pointer;transition:all .2s ease">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span id="manualCloudTxt">${isEn ? "SAVE TO CLOUD NOW" : "SIMPAN CLOUD SEKARANG"}</span>
        </button>
      </div>

      <div style="margin-bottom:14px">
        <button id="refreshUiBtn" type="button" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;font-size:12px;font-weight:800;letter-spacing:1px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.18);color:#f1f2f6;border-radius:8px;cursor:pointer;transition:all .2s ease">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
          <span id="refreshUiTxt">${isEn ? "REFRESH GAME UI" : "REFRESH TAMPILAN (UI)"}</span>
        </button>
      </div>

      <div>
        <button class="reset-btn" id="resetBtn" style="width:100%;padding:10px;font-size:12px;font-weight:800;letter-spacing:1px;background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.3);color:#ff4757;border-radius:8px;cursor:pointer">RESET DATA LOKAL</button>
      </div>
    </div>

  </div>`;
  if(window.lucide) window.lucide.createIcons();
  document.querySelectorAll("#langRow .lang-btn").forEach(btn=>{
    btn.onclick=()=>{
      const l=btn.getAttribute("data-lang");
      if(window.GameLang&&typeof window.GameLang.set==="function"){
        window.GameLang.set(l);
      }else{
        state.lang=(l==="en")?"en":"id";
        save();
        renderSettings();
      }
      if(typeof toast==="function"){
        toast(l==="en"?"LANGUAGE UPDATED":"BAHASA DIUBAH",l==="en"?"Display language set to English":"Bahasa tampilan diubah ke Indonesia","#c56cf0");
      }
    };
  });
  document.getElementById("logoutBtn").onclick=logout;
  const manualCloudBtn=document.getElementById("manualCloudBtn");
  if(manualCloudBtn){
    manualCloudBtn.onclick=async ()=>{
      if(manualCloudBtn.disabled) return;
      manualCloudBtn.disabled=true;
      const txt=document.getElementById("manualCloudTxt");
      const note=document.getElementById("cloudSyncNote");
      const oldTxt = txt ? txt.textContent : "";
      if(txt) txt.textContent = isEn ? "SAVING TO CLOUD..." : "MENYIMPAN KE CLOUD...";
      try {
        save();
        if(typeof pushCloudNow === "function"){
          await pushCloudNow();
        } else if(typeof flushCloudSave === "function"){
          flushCloudSave();
        }
        const nowStr = new Date().toLocaleTimeString();
        if(txt) txt.textContent = isEn ? "SAVED!" : "TERSIMPAN!";
        if(note) note.innerHTML = `<span style="color:#2ed573;font-weight:700">✓ ${isEn ? "Successfully saved to Cloud at " : "Berhasil disimpan ke Cloud pukul "} ${nowStr}</span>`;
        if(typeof toast === "function"){
          toast(isEn ? "CLOUD SYNC" : "SINKRONISASI CLOUD", isEn ? "All cards & inventory saved to server." : "Semua kartu & backpack berhasil disimpan ke server.", "#2ed573");
        }
      } catch(err){
        console.error("Manual cloud save err:", err);
        if(txt) txt.textContent = isEn ? "SAVE FAILED" : "GAGAL MENYIMPAN";
        if(note) note.innerHTML = `<span style="color:#ff4757;font-weight:700">✗ ${err && err.message ? err.message : "Gagal terhubung ke Cloud"}</span>`;
        if(typeof toast === "function"){
          toast("ERROR", isEn ? "Failed to save to cloud" : "Gagal menyimpan ke cloud", "#ff4757");
        }
      } finally {
        setTimeout(()=>{
          manualCloudBtn.disabled=false;
          if(txt) txt.textContent = oldTxt;
        }, 3000);
      }
    };
  }

  const refreshUiBtn=document.getElementById("refreshUiBtn");
  if(refreshUiBtn){
    refreshUiBtn.onclick=()=>{
      try {
        if(typeof renderShell === "function") renderShell();
        renderSettings();
        if(typeof toast === "function"){
          toast(isEn ? "UI REFRESHED" : "TAMPILAN DIPERBARUI", isEn ? "Game interface re-rendered." : "Antarmuka game berhasil dimuat ulang.", "#66fcf1");
        }
      } catch(e){
        console.error("Refresh UI err:", e);
      }
    };
  }
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
      audToggle.onclick=()=>{state.muted=!state.muted;save();paint();if(!state.muted){try{unlockGameAudio();if(window.CyberSfx)window.CyberSfx.katanaSlash(1);}catch(e){}}if(typeof syncBgmState==="function")syncBgmState();};
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
    if(window.GameLang&&typeof window.GameLang.refresh==="function")window.GameLang.refresh();
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
  /* Safety: dokumen selalu di posisi paling atas HANYA jika di view yang terkunci (battle/lobby/tower/raid).
     Jangan paksa scroll ke 0 saat pemain sedang berada di Settings agar halaman settings bisa di-scroll bebas. */
  if((hasBattle||!!app.querySelector(".lobby-hub")||onTower||onRaid) && (window.scrollX||window.scrollY)) window.scrollTo(0,0);
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
document.querySelectorAll(".nav-btn[data-route]").forEach(b=>b.onclick=()=>{
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
  const isEn = (window.GameLang && typeof window.GameLang.get === "function") ? window.GameLang.get() === "en" : true;
  document.getElementById("tabLogin").classList.toggle("active",m==="login");
  document.getElementById("tabRegister").classList.toggle("active",m==="register");
  document.getElementById("auSubmit").textContent = m === "login" ? (isEn ? "LOGIN" : "MASUK") : (isEn ? "REGISTER" : "DAFTAR");
  document.getElementById("tabLogin").textContent = isEn ? "LOGIN" : "MASUK";
  document.getElementById("tabRegister").textContent = isEn ? "REGISTER" : "DAFTAR";
  document.getElementById("auErr").textContent="";
  /* layar login cyber: brand pane flip ke kanan saat mode daftar */
  var card=document.getElementById("auCard"); if(card) card.classList.toggle("flip",m==="register");
  var hd=document.getElementById("hdMode"); if(hd) hd.textContent=m==="login"?(isEn?"Hunter Login":"Hunter Login"):(isEn?"Hunter Register":"Hunter Register");
  var tg=document.getElementById("brandTag");
  if(tg) tg.innerHTML=m==="login"
    ? (isEn ? 'Log in to continue your <b>journey</b> conquering the arena and building your shadow army.' : 'Masuk untuk melanjutkan <b>perjalananmu</b> menaklukkan arena dan membangun shadow army.')
    : (isEn ? 'Register to <b>awaken as a Player</b> — your progress syncs directly to the Cloud.' : 'Daftar untuk <b>terbangun sebagai Player</b> — progresmu langsung tersimpan di Cloud.');
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
  const isEn = (window.GameLang && typeof window.GameLang.get === "function") ? window.GameLang.get() === "en" : true;
  document.getElementById("asTxt").textContent = authMode === "register"
    ? (isEn ? "Registering to Cloud…" : "Mendaftarkan ke Cloud…")
    : (isEn ? "Connecting to Cloud…" : "Menghubungkan ke Cloud…");
  document.getElementById("authSpin").classList.remove("hidden");

  const finish=()=>{document.getElementById("authSpin").classList.add("hidden");btn.disabled=false;btn.classList.remove("press");};
  const users=getUsers(), key=name.toLowerCase(), passH=hashPass(pass);

  /* WAJIB ONLINE: Game ini sepenuhnya online dan terhubung ke Supabase.
     Jika modul CloudDB / CloudAuth gagal dimuat atau internet terputus, tolak akses. */
  if(!navigator.onLine || !window.CloudDB || !window.CloudAuth){
    auError("Tidak dapat terhubung ke server Supabase. Pastikan internet aktif dan refresh halaman.");
    finish();
    return;
  }

  /* 1. Identitas cloud. Login: jalur Auth (JWT) dulu — signIn = bukti password,
     lalu save dibaca lewat token (0020). Pemain lama yang belum punya akun Auth
     diverifikasi lewat RPC check_credentials (definer), lalu sesi dibuat +
     uid ditautkan. Anon tidak lagi dipakai sebagai bukti "akun ada" (2c). */
  let cloudUser=null, cloudOk=false, loginErrReason="";
  if(authMode!=="register"){
    const jwt = await window.CloudAuth.authenticate(key, passH);
    if(jwt && jwt.ok){
      cloudOk=true;
      cloudUser={username:jwt.username, save_data:jwt.save_data};
    }else{
      loginErrReason = (jwt && jwt.reason) || "";
      let chk=null;
      try { chk = await window.CloudDB.checkCredentials(key, passH); }
      catch(err){ console.warn("checkCredentials err:", err); }
      if(chk && chk.ok){
        cloudOk=true;
        /* Ditautkan dulu (bukan tembak-lari): enterGame langsung membaca save lewat JWT. */
        try { await window.CloudAuth.connect(key, passH); }
        catch(err){ console.warn("Auth connect err:", err); }
      }
    }
  }

  if(authMode==="register"){
    /* Register cloud: jangan blokir hanya karena users[key] ada di localStorage lama,
       karena bisa jadi data lokal sisa sementara akun di Supabase belum ada/sudah dihapus.
       Biarkan server Supabase yang menjadi penentu tunggal apakah username sudah dipakai. */
    const initSt = freshState();
    const ep = await window.CloudAuth.ensurePass(key, passH);
    if(!ep || !ep.ok){
      const rsn = (ep && ep.reason) || "koneksi ditolak";
      if(rsn === "USER_EXISTS"){
        auError("Username ini sudah terdaftar di server (dengan password berbeda). Silakan klik MASUK atau pilih username lain.");
      }else if(rsn === "RATE_LIMIT"){
        auError("Terlalu banyak percobaan daftar dalam waktu singkat. Tunggu 1 menit lalu coba lagi.");
      }else if(rsn === "confirm_email_on"){
        auError("Fitur Confirm Email di Supabase masih aktif. Matikan dulu di pengaturan Auth Supabase.");
      }else{
        auError("Gagal mendaftar ke server: " + rsn);
      }
      finish();
      return;
    }
    let reg=null;
    try {
      reg = await window.CloudDB.registerUser(name, initSt, passH);
    } catch(err){ console.error("Cloud register fail:", err); }
    if(!reg || reg.ok === false){
      const errMsg = (reg && reg.msg) || "Server menolak pendaftaran";
      auError(errMsg === "TAKEN" ? "Username itu sudah dipakai di server. Coba masuk." : ("Pendaftaran cloud gagal: " + errMsg));
      finish();
      return;
    }
    if(reg && reg.created === false){
      auError("Username itu sudah terdaftar di server. Silakan masuk (Login).");
      finish();
      return;
    }
    users[key]={name,pass:passH,created:Date.now()};
    saveUsers(users);

    finish();
    enterGame(name, true);
  }else{
    // Mode LOGIN: 100% WAJIB CLOUD SUPABASE (Tanpa fallback lokal offline)
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
      if(loginErrReason === "no_save"){
        auError("Akun belum memiliki data di server. Silakan klik DAFTAR untuk membuat akun di Cloud.");
      }else{
        auError("Username belum terdaftar di server atau password salah.");
      }
      finish();
      return;
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
  /* Sesi Auth harus SIAP sebelum updateSession & pull save: keduanya sudah
     membaca lewat JWT, dan anon dicabut di 0021. Await ini cegah pull gagal
     -> save lokal basi menimpa progres cloud. */
  if(window.CloudAuth){
    try { await window.CloudAuth.kick(name); }
    catch(e){ console.warn("Auth kick err:", e && e.message); }
  }
  /* RPC GUARD (0032): akun yang ketahuan memanggil RPC lewat curl/Postman/script
     sudah dikunci server (403 GUARD_PENDING). Tampilkan bom 30 detik lalu reset
     SEBELUM save lama ditarik. Balasan true = reset berjalan, hentikan enterGame. */
  if(window.ACBRpcGuard){
    try { if(await window.ACBRpcGuard.check(name)) return; }
    catch(e){ console.warn("RPC guard err:", e && e.message); }
  }
  // Sinkronisasi data cloud terbaru saat masuk game (WAJIB ONLINE)
  if(!window.CloudDB){
    logout();
    return;
  }
  try {
    const cUser = await window.CloudDB.getUser(name);
    if(cUser && cUser.save_data){
      localStorage.setItem("aab-state-v2:" + name, JSON.stringify(cUser.save_data));
    }
  } catch(err){ console.warn("Cloud pull fail on enterGame:", err); }

  if(window.CloudDB && window.CURRENT_DEVICE_SESSION){
    window.CloudDB.updateSession(name, window.CURRENT_DEVICE_SESSION).catch(()=>{});
    if(window.startSessionHeartbeat) window.startSessionHeartbeat(name);
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
  const isEn = (typeof window.GameLang !== "undefined" && typeof window.GameLang.get === "function") ? window.GameLang.get() === "en" : true;
  const steps = isEn
    ? ["Syncing telemetry…", "Assembling deck matrix…", "Calibrating arena…", "Loading sector…", "Ready!"]
    : ["Menyinkronkan data…", "Membangun deck…", "Menyiapkan arena…", "Memuat dunia…", "Siap!"];
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
async function logout(){
  try {
    save();
    if(typeof pushCloudNow === "function"){
      await pushCloudNow();
    } else if(typeof flushCloudSave === "function"){
      flushCloudSave();
    }
  } catch(e){
    console.warn("Logout cloud push error:", e);
  }
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
  const c=document.getElementById("changelogModal");
  if(c&&(c.classList.contains("show")||c.style.display==="flex"))closeChangelogModal();
  const rb=document.getElementById("rebirthModal");
  if(rb&&rb.classList.contains("show")){if(typeof closeRebirthModal==='function')closeRebirthModal();else rb.classList.remove("show");}
});

/* ========== UPDATE LOG MODAL ========== */
const GAME_CHANGELOGS = [
  {
    version: "v1.4.3",
    date: "27 Okt 2026",
    title: "Rebirth Matrix & UI Stabilization",
    titleEn: "Rebirth Matrix & UI Stabilization",
    items: [
      "Modal Rebirth Horizontal Cyberpunk baru dengan visual Sigil Core, live Essence meter, dan Ascension Protocol.",
      "Perbaikan scroll reset & auto-tick pada menu Pengaturan dan Lobby (eliminasi re-render 1 detik via caching DOM).",
      "Pemisahan Buff Potion Dock: kini eksklusif tampil di Lobby dan otomatis tersembunyi saat membuka Index, Profil, atau Modal.",
      "Interaktivitas Slot Operator Profil: klik slot Pet/Artefak/Kartu langsung menuju Backpack + Hover Card Preview.",
      "Optimalisasi observer sistem lokalisasi multi-bahasa (English & Bahasa Indonesia) bebas rekursi."
    ],
    itemsEn: [
      "New Cyberpunk Horizontal Rebirth Modal featuring Sigil Core, live Essence meter, and Ascension Protocol.",
      "Fixed scroll reset & auto-tick glitch in Settings and Lobby (preventing 1-second interval DOM wipes via dataset caching).",
      "Buff Potion Dock isolation: strictly visible in Lobby and automatically hidden when opening Index, Profile, or Modals.",
      "Interactive Profile Operator Slots: click Pet/Artefact/Card slots to navigate to Backpack + Card Hover Preview.",
      "Multi-language (EN / ID) localization observer optimization with recursion-free DOM traversal."
    ]
  },
  {
    version: "v1.4.2",
    date: "26 Okt 2026",
    title: "Performance & Cloud Sync Update",
    items: [
      "Fitur Manual Cloud Save di menu Pengaturan (simpan seluruh kartu & backpack langsung ke Supabase).",
      "Pembersihan partikel pertempuran (0 FX particles) untuk meningkatkan performa di HP kentang.",
      "Perbaikan navigasi scroll pada halaman Pengaturan.",
      "Tombol Refresh Game UI untuk memuat ulang elemen tampilan tanpa refresh halaman.",
      "Tombol Update Log baru di header navigasi."
    ]
  },
  {
    version: "v1.4.1",
    date: "26 Okt 2026",
    title: "CrazyGames SDK & 7-Day Rewards",
    items: [
      "Integrasi resmi CrazyGames SDK v3 (Rewarded Ads dengan hadiah 2x Global Luck & Instant 100K Pack).",
      "Sistem 7-Day Attendance Reward horizontal baru dengan Instant Roll Packs langsung ke Backpack.",
      "BGM baru Cyberpunk Electronic Synthwave di Lobby dengan autoplay gesture unlock.",
      "Dukungan multi-bahasa penuh (English & Bahasa Indonesia) dengan selector di Pengaturan."
    ]
  },
  {
    version: "v1.4.0",
    date: "25 Okt 2026",
    title: "Security & Leaderboard v2",
    items: [
      "Pembaruan Leaderboard v2 dengan podium visual Top 3 dan dossier profil publik.",
      "Anti-cheat terpadu: DevTools Guard (0031) & RPC Guard Honeypot (0032).",
      "World Boss damage kalkulasi nyata & perbaikan sinkronisasi cloud state."
    ]
  }
];

function openChangelogModal(){
  const b=document.getElementById("changelogBackdrop"), m=document.getElementById("changelogModal");
  if(b){b.classList.add("show");b.style.display="block";b.onclick=closeChangelogModal;}
  if(m){
    m.classList.add("show");m.style.display="flex";
    renderChangelogModal();
  }
}
function closeChangelogModal(){
  const b=document.getElementById("changelogBackdrop"), m=document.getElementById("changelogModal");
  if(b){b.classList.remove("show");b.style.display="none";}
  if(m){m.classList.remove("show");m.style.display="none";}
}
function renderChangelogModal(){
  const list = document.getElementById("changelogList");
  if(!list) return;
  const isEn = (typeof getLang === 'function' && getLang() === 'en') || 
               (typeof state !== 'undefined' && state && state.lang === 'en') ||
               (window.GameLang && typeof window.GameLang.get === "function" && window.GameLang.get() === "en");
  list.innerHTML = GAME_CHANGELOGS.map(log => {
    const title = (isEn && log.titleEn) ? log.titleEn : log.title;
    const items = (isEn && log.itemsEn) ? log.itemsEn : log.items;
    return `
    <div style="background:linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02));border:1px solid rgba(102,252,241,0.2);border-radius:12px;padding:14px;box-shadow:0 4px 16px rgba(0,0,0,0.3)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="background:rgba(102,252,241,0.2);color:#66fcf1;font-size:11px;font-weight:900;padding:2px 8px;border-radius:6px;border:1px solid rgba(102,252,241,0.4)">${log.version}</span>
          <span style="font-size:13px;font-weight:800;color:#fff">${title}</span>
        </div>
        <span style="font-size:11px;color:#a4b0be;font-weight:600">${log.date}</span>
      </div>
      <ul style="margin:0;padding-left:18px;color:#dcdde1;font-size:12px;line-height:1.6">
        ${items.map(it => `<li>${it}</li>`).join("")}
      </ul>
    </div>
  `}).join("");
}
window.openChangelogModal = openChangelogModal;
window.closeChangelogModal = closeChangelogModal;
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

  /* Jaringan: pantau koneksi internet real-time (Game wajib online) */
  (function(){
    let netBar=null;
    const ensureNetBar=()=>{
      if(netBar)return netBar;
      netBar=document.createElement("div");
      netBar.id="onlineGuardOverlay";
      netBar.style.cssText="position:fixed;inset:0;background:rgba(5,7,13,0.94);z-index:9999998;display:none;align-items:center;justify-content:center;padding:20px;font-family:sans-serif;backdrop-filter:blur(8px);";
      netBar.innerHTML=`
        <div style="background:#0d1322;border:1px solid #ff4757;border-radius:16px;padding:28px 24px;max-width:360px;text-align:center;color:#fff;box-shadow:0 0 40px rgba(255,71,87,0.35);">
          <div style="font-size:38px;margin-bottom:10px">📡</div>
          <div style="font-size:17px;font-weight:800;color:#ff4757;letter-spacing:1px;margin-bottom:8px">KONEKSI TERPUTUS</div>
          <div style="font-size:13px;color:#94a3b8;line-height:1.5;margin-bottom:20px">Game ini membutuhkan koneksi internet aktif ke server Supabase. Periksa jaringan kamu untuk melanjutkan permainan.</div>
          <button onclick="location.reload()" style="background:linear-gradient(135deg,#ff4757,#e84118);color:#fff;border:none;padding:11px 26px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;letter-spacing:0.5px">MUAT ULANG</button>
        </div>
      `;
      document.body.appendChild(netBar);
      return netBar;
    };
    window.addEventListener("offline",()=>{ensureNetBar().style.display="flex";});
    window.addEventListener("online",()=>{if(netBar)netBar.style.display="none";});
    if(!navigator.onLine)ensureNetBar().style.display="flex";
  })();

  /* Indikator jumlah player aktif / online di pojok kiri bawah (menggantikan label BUILD) */
  (function(){
    const d=document.createElement("div");
    d.id="activePlayersBadge";
    d.style.cssText="position:fixed;left:8px;bottom:8px;z-index:999999;display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;background:rgba(8,12,24,0.82);border:1px solid rgba(74,222,128,0.35);font:700 10.5px 'Rajdhani',monospace;letter-spacing:0.08em;color:#e2e8f0;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,0.6);backdrop-filter:blur(4px);";
    d.innerHTML='<span style="width:6px;height:6px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80;display:inline-block;"></span><span>ACTIVE PLAYER ON: <b id="apCountVal" style="color:#4ade80;">1</b></span>';
    document.body.appendChild(d);
    const pollActivePlayers=async()=>{
      if(document.hidden||!navigator.onLine||!window.CloudDB||typeof window.CloudDB.getOnlinePlayersCount!=="function")return;
      try{
        const cnt=await window.CloudDB.getOnlinePlayersCount();
        const el=document.getElementById("apCountVal");
        if(el&&typeof cnt==="number"&&cnt>=1)el.textContent=cnt.toLocaleString("id-ID");
      }catch(e){}
    };
    setTimeout(pollActivePlayers,1200);
    setInterval(pollActivePlayers,25000);
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
