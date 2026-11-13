/* ==========================================================================
   CRAZYGAMES SDK v3 OFFICIAL INTEGRATION MODULE
   Quality Guidelines, Lifecycle Management, Ad Handling, and Onboarding FTUE
   ========================================================================== */
(function () {
  'use strict';

  // Deteksi lingkungan CrazyGames (SDK yang SUDAH berhasil init, iframe
  // crazygames, atau query param). Jangan pakai "window.CrazyGames.SDK ada" —
  // script SDK selalu ikut termuat di <head>, jadi di GitHub Pages / preview
  // lokal pun objeknya ada; jalur itu membuat loginAsGuest() menunggu
  // SDK.user.getUser() yang tidak pernah resolve di luar portal (SDK-nya belum
  // / tidak bisa init) sehingga pemain macet di "Entering Game as Guest...".
  function isCrazyGamesEnvironment() {
    try {
      if (location.search.includes('crazygames=1')) return true;
      const _cgSdk = window.CrazyGames && window.CrazyGames.SDK; if (_cgSdk && _cgSdk.environment === 'crazygames') return true;
      if (window.self !== window.top) {
        if (document.referrer && document.referrer.includes('crazygames')) return true;
        try {
          if (window.location.ancestorOrigins) {
            for (let i = 0; i < window.location.ancestorOrigins.length; i++) {
              if (window.location.ancestorOrigins[i].includes('crazygames.com')) return true;
            }
          }
        } catch(e) {}
      }
    } catch (e) {}
    return false;
  }
  window.isCrazyGames = isCrazyGamesEnvironment;

  // Inisialisasi SDK v3 (hanya 1x seumur hidup halaman)
  let _cgInitialized = false;
  let _cgInitPromise = null;
  function initCrazyGames() {
    if (_cgInitPromise) return _cgInitPromise;
    _cgInitPromise = (async () => {
      try {
        const sdk = window.CrazyGames && window.CrazyGames.SDK;
        if (sdk && sdk.environment !== 'disabled') {
          await sdk.init();
          _cgInitialized = true;
          window.__cgSdkReady = true;
          console.log('[CrazyGames SDK v3] Initialized successfully (' + (sdk.environment || 'portal') + ')');
        }
      } catch (e) {
        console.warn('[CrazyGames SDK v3] Init note:', e && e.message);
      } finally {
        // "sudah mencoba" != "berhasil": boot.js menunggu sinyal ini supaya tidak
        // salah memilih identitas (CG_<user> vs guest lokal) saat init masih jalan.
        window.__cgSdkDone = true;
      }
    })();
    return _cgInitPromise;
  }
  window.cgEnsureInit = initCrazyGames;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCrazyGames);
  } else {
    initCrazyGames();
  }

  // Lifecycle Callbacks
  window.cgLoadingStart = function () {
    try {
      if (window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
        window.CrazyGames.SDK.game.loadingStart();
      }
    } catch (e) {}
  };

  window.cgLoadingStop = function () {
    try {
      if (window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
        window.CrazyGames.SDK.game.loadingStop();
      }
    } catch (e) {}
  };

  let _gameplayRunning = false;
  window.cgGameplayStart = function () {
    try {
      if (!_gameplayRunning && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
        _gameplayRunning = true;
        window.CrazyGames.SDK.game.gameplayStart();
      }
    } catch (e) {}
  };

  window.cgGameplayStop = function () {
    try {
      if (_gameplayRunning && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
        _gameplayRunning = false;
        window.CrazyGames.SDK.game.gameplayStop();
      }
    } catch (e) {}
  };

  window.cgHappyTime = function () {
    try {
      if (window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
        window.CrazyGames.SDK.game.happytime();
      }
    } catch (e) {}
  };

  // Shared Ad Runner (Rewarded & Midgame) with BGM/SFX mute + gameplay pause
  let _lastAdAt = 0;
  const MIDGAME_COOLDOWN_MS = 180000;

  function requestCrazyAd(type, onSuccess, onError) {
    const sdk = window.CrazyGames && window.CrazyGames.SDK;
    if (!sdk || !sdk.ad || sdk.environment === 'disabled') return false;
    if (!window.__cgSdkReady && !isCrazyGamesEnvironment()) return false;

    const wasMuted = (typeof state !== 'undefined' && state && state.muted);
    const wasGameplayRunning = _gameplayRunning;
    const syncAudio = () => {
      try { if (typeof window.syncBgmState === 'function') window.syncBgmState(); } catch (e) {}
    };
    const restoreAfterAd = () => {
      _lastAdAt = Date.now();
      if (typeof state !== 'undefined' && state) state.muted = wasMuted;
      syncAudio();
      if (wasGameplayRunning) window.cgGameplayStart();
    };

    const callbacks = {
      adStarted: () => {
        if (typeof state !== 'undefined' && state) state.muted = true;
        syncAudio();
        if (wasGameplayRunning) window.cgGameplayStop();
      },
      adFinished: () => {
        restoreAfterAd();
        if (typeof onSuccess === 'function') onSuccess();
      },
      adError: (error) => {
        restoreAfterAd();
        console.warn('[CrazyGames Ad Error]', type, error);
        if (typeof onError === 'function') onError(error);
      }
    };

    try {
      sdk.ad.requestAd(type, callbacks);
      return true;
    } catch (err) {
      restoreAfterAd();
      console.warn('[CrazyGames Ad exception]', type, err);
      return false;
    }
  }

  window.cgRequestRewardedAd = function (onSuccess, onError) {
    return requestCrazyAd('rewarded', onSuccess, onError);
  };

  window.cgRequestMidgameAd = function (onDone) {
    return requestCrazyAd('midgame', onDone, onDone);
  };

  // Cooldown-gated midgame ad for natural battle-to-lobby transitions on CrazyGames
  window.cgTryMidgameAd = function (onDone) {
    const done = typeof onDone === 'function' ? onDone : function () {};
    if (!isCrazyGamesEnvironment() || !window.__cgSdkReady) { done(); return false; }
    if (isNewPlayerEligible()) { done(); return false; }
    if (_lastAdAt && (Date.now() - _lastAdAt) < MIDGAME_COOLDOWN_MS) { done(); return false; }
    const started = requestCrazyAd('midgame', done, done);
    if (!started) done();
    return started;
  };

  // =========================================================================
  // TACTICAL AVATAR GUIDE (Interactive 8-Step RPG FTUE — WoB Hazard)
  // 1: Intro Dialogue -> 2: Roll 10x -> 3: Open Deck -> 4: Equip Best ->
  // 5: Close Deck [x] -> 6: Open Story Gate -> 7: Select Stage 1 -> 8: Play
  // =========================================================================
  function ftueUserId() {
    return (typeof currentUser === 'string' && currentUser) ? currentUser.toLowerCase() : 'local';
  }
  function ftueDoneKey() { return 'aab_onboarding_done_' + ftueUserId(); }
  function ftuePhaseKey() { return 'aab_ftue_phase_' + ftueUserId(); }
  const GUIDE_AVATAR_SRC = 'assets/cards/thumb/copyblade-mentor.webp';
  let _lastRenderSig = '';
  let _hooksWired = false;
  let _scrolledStoryOnce = false;

  function getPhase() {
    const raw = parseInt(localStorage.getItem(ftuePhaseKey()) || '1', 10);
    return (raw >= 1 && raw <= 8) ? raw : 1;
  }
  function setPhase(p) {
    localStorage.setItem(ftuePhaseKey(), String(p));
    _lastRenderSig = '';
  }

  function isNewPlayerEligible() {
    if (typeof state === 'undefined' || !state) return false;
    if (typeof currentUser !== 'string' || !currentUser) return false;
    const doneKey = ftueDoneKey();
    if (localStorage.getItem(doneKey) === '1') return false;
    const rolls = state.totalRolls || 0;
    const clearedCnt = state.cleared ? Object.keys(state.cleared).length : 0;
    const towerBest = (state.tower && state.tower.best) ? state.tower.best : 0;
    const hasPhase = !!localStorage.getItem(ftuePhaseKey());
    if (clearedCnt > 0 || towerBest > 0 || (rolls >= 12 && !hasPhase)) {
      localStorage.setItem(doneKey, '1');
      return false;
    }
    return true;
  }

  function isElVisible(el) {
    if (!el) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  }

  function isRollOverlayVisible() {
    const ov = document.getElementById('rollOverlay');
    return isElVisible(ov);
  }

  function isDeckModalOpen() {
    const dm = document.getElementById('deckModal');
    return !!(dm && dm.classList.contains('show'));
  }

  function isStoryModalOpen() {
    const sm = document.getElementById('storyModal');
    return !!(sm && sm.classList.contains('show'));
  }

  function canRenderFtue() {
    const ls = document.getElementById('loadingScreen');
    if (ls && !ls.classList.contains('hidden') && getComputedStyle(ls).display !== 'none') return false;
    if (typeof battleLive === 'function' && battleLive()) return false;
    if (isRollOverlayVisible()) return false;
    if (document.querySelector('#dailyModal.show')) return false;
    if (isDeckModalOpen() || isStoryModalOpen()) return true;
    if (!document.body.classList.contains('on-lobby')) return false;
    const blockCls = ['bp-open', 'hide-docks-modal', 'drawer-open', 'dl-open', 'profile-open'];
    for (let i = 0; i < blockCls.length; i++) {
      if (document.body.classList.contains(blockCls[i])) return false;
    }
    return true;
  }

  function ensureHooks() {
    if (_hooksWired) return;
    _hooksWired = true;
    document.addEventListener('click', (e) => {
      if (!isNewPlayerEligible()) return;
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('#dkActBest')) {
        if (getPhase() <= 4) {
          setPhase(5);
          setTimeout(renderOnboardingGuide, 60);
        }
      } else if (t.closest('#dkClose') && getPhase() === 5) {
        setPhase(6);
        setTimeout(renderOnboardingGuide, 80);
      } else if (t.closest('#mapNodesContainer .map-node[data-i="0"]')) {
        if (isStoryModalOpen() && getPhase() <= 7) {
          setPhase(8);
          setTimeout(renderOnboardingGuide, 80);
        }
      } else if (t.closest('#btnDeploy') || t.closest('#btnMqDeploy')) {
        if (isStoryModalOpen()) {
          localStorage.setItem(ftueDoneKey(), '1');
          removeFtueDom();
          window.cgHappyTime();
        }
      }
    }, true);
  }

  function ensureVisibleInScrollParents(el) {
    if (!el) return;
    let p = el.parentElement;
    let needsScroll = false;
    while (p && p !== document.body && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY + ' ' + cs.overflowX)) {
        const pr = p.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        if (er.top < pr.top + 4 || er.bottom > pr.bottom - 4 || er.left < pr.left + 4 || er.right > pr.right - 4) {
          needsScroll = true;
          break;
        }
      }
      p = p.parentElement;
    }
    const vr = el.getBoundingClientRect();
    if (needsScroll || vr.bottom > window.innerHeight - 4 || vr.top < 4) {
      try { el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' }); } catch (e) {}
    }
  }

  function updateSpotlight(targetEl) {
    let spot = document.getElementById('hzFtueSpot');
    if (!targetEl || !isElVisible(targetEl)) {
      if (spot) spot.style.display = 'none';
      return null;
    }
    ensureVisibleInScrollParents(targetEl);
    const r = targetEl.getBoundingClientRect();
    if (!spot) {
      spot = document.createElement('div');
      spot.id = 'hzFtueSpot';
      spot.className = 'hz-ftue-spot';
      spot.innerHTML = '<span class="hz-spot-tag" aria-hidden="true">TAP</span>';
      document.body.appendChild(spot);
    }
    const pad = 4;
    const rawL = Math.max(2, Math.min(window.innerWidth - 28, Math.round(r.left - pad)));
    const rawT = Math.max(2, Math.min(window.innerHeight - 28, Math.round(r.top - pad)));
    const rawR = Math.min(window.innerWidth - 2, Math.round(r.right + pad));
    const rawB = Math.min(window.innerHeight - 2, Math.round(r.bottom + pad));
    const w = Math.max(24, rawR - rawL);
    const h = Math.max(24, rawB - rawT);
    const x = rawL;
    const y = rawT;
    spot.style.display = 'block';
    spot.style.width = w + 'px';
    spot.style.height = h + 'px';
    spot.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
    spot.classList.toggle('tag-below', y < 38);
    return r;
  }

  function clearFtueHighlight() {
    const spot = document.getElementById('hzFtueSpot');
    if (spot) spot.style.display = 'none';
  }

  function removeFtueDom() {
    clearFtueHighlight();
    const g = document.getElementById('hzFtueGuide');
    if (g) g.remove();
    const s = document.getElementById('hzFtueSpot');
    if (s) s.remove();
    _lastRenderSig = '';
  }

  function getVisiblePlayButton() {
    const sheetBtn = document.querySelector('#storyModal.sheet-open #btnDeploy');
    if (isElVisible(sheetBtn)) return sheetBtn;
    const deskBtn = document.querySelector('#storyModal #btnDeploy');
    if (isElVisible(deskBtn)) return deskBtn;
    const mqBtn = document.querySelector('#storyModal #btnMqDeploy');
    if (isElVisible(mqBtn)) return mqBtn;
    return null;
  }

  function renderOnboardingGuide() {
    ensureHooks();
    if (!isNewPlayerEligible() || !canRenderFtue()) {
      const g = document.getElementById('hzFtueGuide');
      if (g) g.style.display = 'none';
      clearFtueHighlight();
      return;
    }

    const rolls = state.totalRolls || 0;
    let phase = getPhase();

    // Sinkronisasi fase otomatis sesuai layar dan progres pemain
    if (isDeckModalOpen()) {
      if (phase < 4) { phase = 4; setPhase(4); }
      if (phase > 5) { phase = 5; setPhase(5); }
    } else if (isStoryModalOpen()) {
      if (phase < 7) { phase = 7; setPhase(7); }
    } else {
      if (phase === 2 && rolls >= 10) { phase = 3; setPhase(3); }
      if ((phase === 4 || phase === 5)) {
        const hasEquip = Array.isArray(state.deck) && state.deck.some(Boolean);
        phase = (phase === 5 || hasEquip) ? 6 : 3;
        setPhase(phase);
      }
      if (phase >= 7) { phase = 6; setPhase(6); }
      if (phase >= 3 && rolls < 10) { phase = 2; setPhase(2); }
    }

    let guideEl = document.getElementById('hzFtueGuide');
    if (!guideEl) {
      guideEl = document.createElement('aside');
      guideEl.id = 'hzFtueGuide';
      guideEl.className = 'hz-ftue-wrap';
      guideEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(guideEl);
      _lastRenderSig = '';
    }
    guideEl.style.display = '';

    const isEn = !window.GameLang || typeof window.GameLang.get !== 'function' || window.GameLang.get() === 'en';
    let targetEl = null;
    let placeTop = false;
    let badge = 'STEP 01 / 07';
    let speaker = 'COMMANDER KAKASHI // BRIEFING';
    let line = '';
    let progressHtml = '';
    let ctaLabel = '';
    let ctaAttr = '';

    if (phase === 1) {
      badge = 'STEP 01 / 07';
      line = isEn
        ? 'Welcome to <b>Anime Card Battle RNG</b>, Operator! Monsters are breaching the Hazard Sector — summon heroes, equip your strongest squad, and clear <b>Stage 01</b>!'
        : 'Selamat datang di <b>Anime Card Battle RNG</b>, Operator! Sektor Hazard sedang diserang — panggil hero, pasang tim terkuatmu, lalu taklukkan <b>Stage 01</b>!';
      ctaLabel = isEn ? 'START MISSION' : 'MULAI MISI';
      ctaAttr = 'onclick="hzFtueNext(2)"';
    } else if (phase === 2) {
      badge = 'STEP 02 / 07';
      const capped = Math.min(10, rolls);
      const pct = Math.round((capped / 10) * 100);
      progressHtml =
        '<div class="hz-ftue-prog">' +
          '<div class="hz-ftue-prog-bar"><span style="width:' + pct + '%"></span></div>' +
          '<span class="hz-ftue-prog-txt">ROLLS ' + capped + ' / 10</span>' +
        '</div>';
      line = isEn
        ? 'First objective: summon <b>10 Heroes</b>! Tap <b>ROLL</b> (or <b>AUTO ROLL</b>) below until your summons reach <b>10 / 10</b>.'
        : 'Misi pertama: summon minimal <b>10×</b>! Tekan <b>ROLL</b> (atau <b>AUTO ROLL</b>) di bawah sampai mencapai <b>10 / 10</b>.';
      ctaLabel = isEn ? 'ROLL NOW (' + capped + '/10)' : 'ROLL SEKARANG (' + capped + '/10)';
      ctaAttr = 'onclick="hzFtueRoll()"';
      targetEl = document.getElementById('nhDockRollBtn');
    } else if (phase === 3) {
      badge = 'STEP 03 / 07';
      line = isEn
        ? '10 summons complete! Tap <b>DECK</b> on the bottom right to open your squadron loadout.'
        : '10 summon selesai! Tekan tombol <b>DECK</b> di pojok kanan bawah untuk mengatur timmu.';
      ctaLabel = isEn ? 'OPEN DECK' : 'BUKA DECK';
      ctaAttr = 'onclick="hzFtueOpenDeck()"';
      targetEl = document.getElementById('nhDockDeckBtn') || document.querySelector('.nh-shell .dock-btn[title="Deck Party"]');
    } else if (phase === 4) {
      badge = 'STEP 04 / 07';
      line = isEn
        ? 'Inside Deck Matrix, tap the highlighted <b>EQUIP BEST</b> button to auto-equip your 4 strongest heroes!'
        : 'Di dalam Deck, klik tombol <b>EQUIP BEST</b> yang disorot untuk langsung memasang 4 hero terkuat!';
      targetEl = document.getElementById('dkActBest');
      if (targetEl && isElVisible(targetEl)) {
        const r = targetEl.getBoundingClientRect();
        if (r.top + r.height / 2 > window.innerHeight * 0.56) placeTop = true;
      }
    } else if (phase === 5) {
      badge = 'STEP 05 / 07';
      line = isEn
        ? 'Strongest squad locked in! Now tap <b>&times;</b> at the top-right corner to close the Deck and return to the Lobby.'
        : 'Tim terkuat sudah terpasang! Sekarang tekan tombol <b>&times;</b> di pojok kanan atas untuk keluar dari Deck.';
      targetEl = document.getElementById('dkClose');
      placeTop = false;
    } else if (phase === 6) {
      badge = 'STEP 06 / 07';
      line = isEn
        ? 'Your squad is battle-ready! Enter the <b>STORY GATE</b> building to pick your first campaign mission.'
        : 'Skuadmu siap bertempur! Ketuk bangunan <b>STORY GATE</b> untuk masuk ke mode Story.';
      ctaLabel = isEn ? 'OPEN STORY' : 'BUKA STORY';
      ctaAttr = 'onclick="hzFtueOpenStory()"';
      targetEl = document.getElementById('nhFtueStoryGate') || document.querySelector('.chibi-bldg[title="Enter Story Gate"]');
      if (targetEl && !_scrolledStoryOnce) {
        _scrolledStoryOnce = true;
        try { targetEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); } catch (e) {}
      }
    } else if (phase === 7) {
      badge = 'STEP 07 / 07';
      line = isEn
        ? 'Tap node <b>STAGE 01</b> on the tactical map to lock onto your first opponent!'
        : 'Klik node <b>STAGE 01</b> di peta Story untuk memilih stage pertama!';
      targetEl = document.querySelector('#mapNodesContainer .map-node[data-i="0"]');
      if (targetEl && isElVisible(targetEl)) {
        const r = targetEl.getBoundingClientRect();
        if (r.top + r.height / 2 > window.innerHeight * 0.58) placeTop = true;
      }
    } else if (phase === 8) {
      badge = 'FINAL // BATTLE';
      line = isEn
        ? 'Stage 01 selected! Hit the highlighted <b>PLAY / DEPLOY</b> button to launch combat!'
        : 'Stage 01 dipilih! Tekan tombol <b>PLAY / DEPLOY</b> yang disorot untuk mulai bertarung!';
      targetEl = getVisiblePlayButton();
      placeTop = true;
    }

    guideEl.classList.toggle('is-top', placeTop);
    guideEl.classList.toggle('is-modal', isDeckModalOpen() || isStoryModalOpen());
    updateSpotlight(targetEl);

    const sig = phase + '|' + rolls + '|' + (isEn ? 'en' : 'id') + '|' + (placeTop ? '1' : '0');
    if (_lastRenderSig === sig) return;
    _lastRenderSig = sig;

    const ctaHtml = ctaLabel
      ? '<div class="hz-ftue-acts"><button type="button" class="hz-ftue-cta" ' + ctaAttr + '>' + ctaLabel + ' &rarr;</button></div>'
      : '';

    guideEl.innerHTML =
      '<div class="hz-ftue-card">' +
        '<div class="hz-ftue-ava">' +
          '<img src="' + GUIDE_AVATAR_SRC + '" alt="Commander Kakashi Guide" loading="eager" decoding="async" onerror="this.style.opacity=0">' +
          '<span class="hz-ftue-dot" aria-hidden="true"></span>' +
        '</div>' +
        '<div class="hz-ftue-body">' +
          '<div class="hz-ftue-head">' +
            '<span class="hz-ftue-badge">' + badge + '</span>' +
            '<span class="hz-ftue-name">' + speaker + '</span>' +
          '</div>' +
          '<p class="hz-ftue-text">' + line + '</p>' +
          progressHtml +
          ctaHtml +
        '</div>' +
        '<button type="button" class="hz-ftue-skip" onclick="dismissFtue(event)" aria-label="Skip Tutorial" title="Skip Tutorial">&times;</button>' +
      '</div>';
  }

  window.hzFtueNext = function (p) {
    try { if (window.sfx && window.sfx.hit) window.sfx.hit(); } catch (e) {}
    setPhase(p);
    renderOnboardingGuide();
  };

  window.hzFtueRoll = function () {
    try { if (window.sfx && window.sfx.hit) window.sfx.hit(); } catch (e) {}
    const b = document.getElementById('nhDockRollBtn') || document.getElementById('rollBtn');
    if (b) b.click();
    else if (typeof startRollAnimation === 'function') startRollAnimation();
  };

  window.hzFtueOpenDeck = function () {
    try { if (window.sfx && window.sfx.hit) window.sfx.hit(); } catch (e) {}
    setPhase(4);
    if (typeof openDeckModal === 'function') openDeckModal();
    setTimeout(renderOnboardingGuide, 120);
  };

  window.hzFtueOpenStory = function () {
    try { if (window.sfx && window.sfx.hit) window.sfx.hit(); } catch (e) {}
    setPhase(7);
    if (typeof openStory === 'function') openStory();
    setTimeout(renderOnboardingGuide, 120);
  };

  window.dismissFtue = function (e) {
    if (e) e.stopPropagation();
    localStorage.setItem(ftueDoneKey(), '1');
    removeFtueDom();
  };

  window.triggerFtueCheck = renderOnboardingGuide;

  const _ftueTimer = setInterval(() => {
    if (typeof currentUser === 'string' && currentUser && localStorage.getItem(ftueDoneKey()) === '1') {
      if (document.getElementById('hzFtueGuide') || document.getElementById('hzFtueSpot')) removeFtueDom();
      clearInterval(_ftueTimer);
      return;
    }
    renderOnboardingGuide();
  }, 300);

})();
