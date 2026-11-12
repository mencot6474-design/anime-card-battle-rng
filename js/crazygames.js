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
      if (window.__cgSdkReady) return true;
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

  // =========================================================================
  // ONBOARDING MINI-TUTORIAL (First-Time User Experience)
  // =========================================================================
  function renderOnboardingGuide() {
    if (localStorage.getItem('aab_onboarding_done') === '1') return;
    if (typeof state === 'undefined' || !state) return;

    let guideEl = document.getElementById('ftueGuideOverlay');
    const rollCount = state.rollCount || 0;

    // Selesai onboarding jika sudah roll >= 3 kali dan buka backpack
    if (rollCount >= 3) {
      if (guideEl) guideEl.remove();
      localStorage.setItem('aab_onboarding_done', '1');
      return;
    }

    if (!guideEl) {
      guideEl = document.createElement('div');
      guideEl.id = 'ftueGuideOverlay';
      guideEl.className = 'ftue-guide-wrap';
      document.body.appendChild(guideEl);
    }

    const isEn = (window.GameLang && typeof window.GameLang.get === 'function') ? window.GameLang.get() === 'en' : true;

    if (rollCount === 0) {
      guideEl.innerHTML = `
        <div class="ftue-bubble roll-step">
          <div class="ftue-pulse"></div>
          <div class="ftue-content">
            <div class="ftue-badge">STEP 1 / 2</div>
            <div class="ftue-title">${isEn ? 'SUMMON YOUR FIGHTER!' : 'ROLL KARTU PERTAMAMU!'}</div>
            <div class="ftue-desc">${isEn ? 'Tap the ROLL button below to summon an anime card.' : 'Tekan tombol ROLL di bawah untuk mendapatkan petarung anime!'}</div>
          </div>
          <button class="ftue-skip" onclick="dismissFtue(event)" title="Skip Tutorial">✕</button>
        </div>
      `;
    } else {
      guideEl.innerHTML = `
        <div class="ftue-bubble deck-step">
          <div class="ftue-pulse"></div>
          <div class="ftue-content">
            <div class="ftue-badge">STEP 2 / 2</div>
            <div class="ftue-title">${isEn ? 'CHECK YOUR DECK!' : 'CEK DECK KARTUMU!'}</div>
            <div class="ftue-desc">${isEn ? 'Tap DECK to view stats, passives, and equip your strongest cards!' : 'Tekan DEK untuk memasang kartu terkuatmu ke dalam party!'}</div>
          </div>
          <button class="ftue-skip" onclick="dismissFtue(event)" title="Skip Tutorial">✕</button>
        </div>
      `;
    }
  }

  window.dismissFtue = function (e) {
    if (e) e.stopPropagation();
    const g = document.getElementById('ftueGuideOverlay');
    if (g) g.remove();
    localStorage.setItem('aab_onboarding_done', '1');
  };

  window.triggerFtueCheck = renderOnboardingGuide;

  // Pantau perubahan stage onboarding
  setInterval(() => {
    const isLobby = location.hash === '#/lobby' || location.hash === '' || location.hash === '#';
    const authHidden = document.getElementById('authScreen') && document.getElementById('authScreen').classList.contains('hidden');
    if (isLobby && authHidden && localStorage.getItem('aab_onboarding_done') !== '1') {
      renderOnboardingGuide();
    } else {
      const g = document.getElementById('ftueGuideOverlay');
      if (g) g.style.display = 'none';
    }
  }, 1000);

})();
