/* ==========================================================================
   STORY-CAROUSEL.JS — PURE TACTICAL NODE MAP SYSTEM (PORTED FROM PROTO)
   ========================================================================== */

(function(){
  let currentStageIdx = 0; // index inside current chapter levels (0..5)
  let boundGestures = false;
  let canvasResizeObserver = null;
  let ambientParticles = [];
  let ambientRafId = null;

  // Responsive Node Coordinates
  // Wide / Landscape: dramatic undulating wave (prototype-accurate)
  const COORDS_WIDE = [
    { xPct: 10, yPct: 62 },
    { xPct: 26, yPct: 32 },
    { xPct: 42, yPct: 62 },
    { xPct: 58, yPct: 32 },
    { xPct: 74, yPct: 62 },
    { xPct: 90, yPct: 38 }  // Boss Node
  ];

  // Mobile Portrait: vertical S-curve calibrated to fit 100% inside screen above dock
  const COORDS_PORTRAIT = [
    { xPct: 26, yPct: 10 },
    { xPct: 74, yPct: 23 },
    { xPct: 26, yPct: 36 },
    { xPct: 74, yPct: 49 },
    { xPct: 28, yPct: 62 },
    { xPct: 50, yPct: 76 }  // Boss Node
  ];

  function checkIsPortrait() {
    const canvasEl = document.getElementById("mapCanvas");
    if (canvasEl && canvasEl.offsetWidth > 0 && canvasEl.offsetHeight > 0) {
      return canvasEl.offsetHeight > canvasEl.offsetWidth || canvasEl.offsetWidth <= 560;
    }
    return window.matchMedia("(orientation: portrait)").matches || window.innerWidth <= 640;
  }

  // Ambient Canvas Particles Loop (Lightweight, soft cyan & indigo floating upward)
  function initAmbientParticles(w, h) {
    ambientParticles = [];
    const colors = [
      { r: 56,  g: 189, b: 248 }, // soft cyan
      { r: 129, g: 140, b: 248 }  // soft indigo
    ];
    for (let i = 0; i < 24; i++) {
      const col = colors[i % 2];
      ambientParticles.push({
        x: Math.random() * (w || 800),
        y: Math.random() * (h || 600),
        r: Math.random() * 1.4 + 0.8,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(Math.random() * 0.35 + 0.15),
        alpha: Math.random() * 0.35 + 0.15,
        colorPrefix: `rgba(${col.r}, ${col.g}, ${col.b}, `
      });
    }
  }

  function resizeAmbientCanvas() {
    const cv = document.getElementById("storyAmbientCanvas");
    if (!cv) return { w: 0, h: 0 };
    const w = cv.offsetWidth || cv.parentElement?.offsetWidth || window.innerWidth;
    const h = cv.offsetHeight || cv.parentElement?.offsetHeight || window.innerHeight;
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    return { w, h };
  }

  function startAmbientLoop() {
    const modal = document.getElementById("storyModal");
    if (!modal || (!modal.classList.contains("show") && !modal.classList.contains("active"))) return;
    const cv = document.getElementById("storyAmbientCanvas");
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    if (ambientRafId) {
      cancelAnimationFrame(ambientRafId);
      ambientRafId = null;
    }

    const { w, h } = resizeAmbientCanvas();
    if (!ambientParticles.length || ambientParticles.length < 24) {
      initAmbientParticles(w, h);
    }

    function step() {
      const modalNow = document.getElementById("storyModal");
      if (!modalNow || (!modalNow.classList.contains("show") && !modalNow.classList.contains("active"))) {
        stopAmbientLoop();
        return;
      }

      const curW = cv.width || cv.offsetWidth;
      const curH = cv.height || cv.offsetHeight;

      ctx.clearRect(0, 0, curW, curH);

      for (let i = 0; i < ambientParticles.length; i++) {
        const p = ambientParticles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.y < -10) {
          p.y = curH + 10;
          p.x = Math.random() * curW;
        }
        if (p.x < -10) p.x = curW + 10;
        if (p.x > curW + 10) p.x = -10;

        ctx.fillStyle = p.colorPrefix + p.alpha + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ambientRafId = requestAnimationFrame(step);
    }

    ambientRafId = requestAnimationFrame(step);
  }

  function stopAmbientLoop() {
    if (ambientRafId) {
      cancelAnimationFrame(ambientRafId);
      ambientRafId = null;
    }
    const cv = document.getElementById("storyAmbientCanvas");
    if (cv) {
      const ctx = cv.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
    }
  }

  function initStoryCarousel() {
    const btnBack = document.getElementById("scBtnBack");
    const closeBtn = document.getElementById("smClose");
    const prevBtn = document.getElementById("scPrevChap");
    const nextBtn = document.getElementById("scNextChap");
    const chapInfo = document.getElementById("scChapInfo");
    const btnDeploy = document.getElementById("btnDeploy");
    const btnMqDeploy = document.getElementById("btnMqDeploy");
    const drawerCloseBtn = document.getElementById("scDrawerClose");
    const mqExpandBtn = document.getElementById("btnMqExpand");
    const mobileDock = document.getElementById("mobileQuickDock");
    const loreSubBtn = document.getElementById("btnLoreSub");
    const loreCloseBtn = document.getElementById("btnLoreClose");

    if (btnBack) {
      btnBack.onclick = () => {
        if (window.sfx && sfx.hit) sfx.hit();
        closeStory();
      };
    }
    if (closeBtn) {
      closeBtn.onclick = () => {
        if (window.sfx && sfx.hit) sfx.hit();
        closeStory();
      };
    }

    if (prevBtn) prevBtn.onclick = () => { if (window.sfx && sfx.hit) sfx.hit(); changeStoryChapter(-1); };
    if (nextBtn) nextBtn.onclick = () => { if (window.sfx && sfx.hit) sfx.hit(); changeStoryChapter(1); };
    if (chapInfo) chapInfo.onclick = () => { openLoreModal(); };

    if (btnDeploy) {
      btnDeploy.onclick = () => {
        launchSelectedBattle();
      };
    }
    if (btnMqDeploy) {
      btnMqDeploy.onclick = (e) => {
        e.stopPropagation();
        launchSelectedBattle();
      };
    }

    if (drawerCloseBtn) {
      drawerCloseBtn.onclick = () => {
        closeDrawerOrSheet();
      };
    }

    if (mobileDock) {
      mobileDock.onclick = () => {
        openBottomSheet();
      };
    }
    if (mqExpandBtn) {
      mqExpandBtn.onclick = (e) => {
        e.stopPropagation();
        openBottomSheet();
      };
    }

    if (loreSubBtn) {
      loreSubBtn.onclick = () => {
        openLoreModal();
      };
    }
    if (loreCloseBtn) {
      loreCloseBtn.onclick = () => {
        closeLoreModal();
      };
    }

    // Bind keyboard and resize once
    if (!boundGestures) {
      boundGestures = true;
      window.addEventListener("keydown", (e) => {
        const modal = document.getElementById("storyModal");
        if (!modal || !modal.classList.contains("show")) return;
        if (e.key === "ArrowLeft") slideStoryStage(-1);
        if (e.key === "ArrowRight") slideStoryStage(1);
        if (e.key === "Escape") {
          const lore = document.getElementById("loreModal");
          if (lore && lore.classList.contains("open")) {
            closeLoreModal();
          } else {
            closeStory();
          }
        }
      });

      const handleResize = () => {
        const modal = document.getElementById("storyModal");
        if (modal && (modal.classList.contains("show") || modal.classList.contains("active"))) {
          resizeAmbientCanvas();
          renderTacticalNodes();
        }
      };

      window.addEventListener("resize", handleResize);
      try {
        window.matchMedia("(orientation: portrait)").addEventListener("change", handleResize);
      } catch(e) {}
    }

    // Attach ResizeObserver to canvas if available
    const canvasEl = document.getElementById("mapCanvas");
    if (canvasEl && window.ResizeObserver && !canvasResizeObserver) {
      canvasResizeObserver = new ResizeObserver(() => {
        const modal = document.getElementById("storyModal");
        if (modal && (modal.classList.contains("show") || modal.classList.contains("active"))) {
          resizeAmbientCanvas();
          renderTacticalNodes();
        }
      });
      canvasResizeObserver.observe(canvasEl);
    }
  }

  function openStory(targetChapNo) {
    try {
      if (typeof CHAPTERS === "undefined" || !CHAPTERS || !CHAPTERS.length) {
        console.warn("[StoryCarousel] CHAPTERS not defined yet.");
        return;
      }
      if (typeof targetChapNo === "number") {
        state.chap = targetChapNo;
        save();
      }

      const ch = activeChap();
      if (!cellUnlocked(ch, state.diff)) {
        state.diff = highestChapDiff(ch);
        save();
      }

      // Default stage: first uncleared stage or boss
      const cdh = diffProg()[state.diff];
      let foundStage = 0;
      for (let i = 0; i < ch.levels.length; i++) {
        const lv = ch.from + i;
        if (!cdh[lv]) {
          foundStage = i;
          break;
        }
        foundStage = i;
      }
      currentStageIdx = foundStage;

      // Close missionModal if open
      const mm = document.getElementById("missionModal");
      if (mm) mm.classList.remove("show");

      const modal = document.getElementById("storyModal");
      if (modal) modal.classList.add("show");

      buildStoryChapterDOM();

      startAmbientLoop();

      requestAnimationFrame(() => {
        resizeAmbientCanvas();
        renderTacticalNodes();
        updateStoryDrawer();
      });
    } catch(err) {
      console.error("openStory error:", err);
      try { toast("STORY ERROR", (err && err.message) || "gagal membuka cerita", "#ff5c5c"); } catch(e) {}
    }
  }

  function closeStory() {
    const modal = document.getElementById("storyModal");
    if (modal) {
      modal.classList.remove("show");
      modal.classList.remove("active");
    }
    stopAmbientLoop();
    closeDrawerOrSheet();
    closeLoreModal();
  }

  function changeStoryChapter(dir) {
    if (typeof CHAPTERS === "undefined" || !CHAPTERS) return;
    const currentChapNo = state ? state.chap : 1;
    let nextChapNo = currentChapNo + dir;
    if (nextChapNo < 1) nextChapNo = 1;
    if (nextChapNo > CHAPTERS.length) nextChapNo = CHAPTERS.length;

    const nextChap = CHAPTERS.find(c => c.no === nextChapNo);
    if (!nextChap) return;

    if (!cellUnlocked(nextChap, state.diff)) {
      if (window.sfx && sfx.lose) sfx.lose();
      try { toast("TERKUNCI", cellReqText(nextChap, state.diff), "#ff5c5c"); } catch(e){}
      return;
    }

    state.chap = nextChapNo;
    save();

    const cdh = diffProg()[state.diff];
    let foundStage = 0;
    for (let i = 0; i < nextChap.levels.length; i++) {
      const lv = nextChap.from + i;
      if (!cdh[lv]) {
        foundStage = i;
        break;
      }
      foundStage = i;
    }
    currentStageIdx = foundStage;

    buildStoryChapterDOM();
  }

  function buildStoryChapterDOM() {
    initStoryCarousel();

    const ch = activeChap();
    const currentChapNo = ch.no;

    // Header Title
    const badgeEl = document.getElementById("chapBadgeNo");
    const nameEl = document.getElementById("chapTitleName");
    if (badgeEl) badgeEl.textContent = `BAB 0${ch.no}`;
    const chapNames = {"1":"DESA LEMBAH NINJA","2":"ORBIT PLANET HIJAU","3":"KORIDOR STASIUN SHIBUYA","4":"MUSHIMA TOWN","5":"ISTANA INFINITE TSUDZUMI"};
    if (nameEl) nameEl.textContent = chapNames[ch.no] || ch.zone;

    // Prev / Next Chapter Buttons
    const prevBtn = document.getElementById("scPrevChap");
    const nextBtn = document.getElementById("scNextChap");
    if (prevBtn) prevBtn.disabled = currentChapNo <= 1;
    if (nextBtn) nextBtn.disabled = currentChapNo >= CHAPTERS.length;

    // Render Difficulty Pills
    const diffGroup = document.getElementById("scDiffGroup");
    if (diffGroup && typeof DIFFS !== "undefined" && DIFFS) {
      diffGroup.innerHTML = DIFFS.map(d => {
        const unl = cellUnlocked(ch, d.k);
        const on = d.k === state.diff;
        const diffClass = d.k === 'hard' ? 'active-hrd'
          : d.k === 'extreme' ? 'active-ext'
          : d.k === 'nightmare' ? 'active-ngt'
          : d.k === 'apocalypse' ? 'active-apo'
          : 'active-nor';
        const labelText = d.l || d.k.toUpperCase();
        return `<button class="diff-btn${on ? ' ' + diffClass : ''}" data-d="${d.k}" ${unl ? '' : 'disabled'}>${labelText}</button>`;
      }).join("");

      diffGroup.querySelectorAll(".diff-btn").forEach(b => {
        b.onclick = () => {
          const k = b.dataset.d;
          if (!cellUnlocked(ch, k)) {
            if (window.sfx && sfx.lose) sfx.lose();
            try { toast("TERKUNCI", cellReqText(ch, k), "#ff5c5c"); } catch(e){}
            return;
          }
          if (state.diff === k) return;
          state.diff = k;
          if (window.sfx && sfx.hit) sfx.hit();
          save();
          buildStoryChapterDOM();
        };
      });
    }

    // Update Sub-Bar Progress
    const cdh = diffProg()[state.diff];
    let clearedCount = 0;
    for (let i = 0; i < ch.levels.length; i++) {
      if (cdh[ch.from + i]) clearedCount++;
    }
    const totalCount = ch.levels.length;
    const pct = Math.round((clearedCount / totalCount) * 100);

    const progTxt = document.getElementById("subProgText");
    const progFill = document.getElementById("subProgFill");
    if (progTxt) progTxt.textContent = `${clearedCount} / ${totalCount} SELESAI (${pct}%)`;
    if (progFill) progFill.style.width = `${pct}%`;

    // Render Tactical Map Nodes & Connections
    renderTacticalNodes();

    // Update Drawer Briefing Info
    updateStoryDrawer();
  }

  function renderTacticalNodes() {
    const ch = activeChap();
    const cdh = diffProg()[state.diff];
    const cellOpen = cellUnlocked(ch, state.diff);

    const canvasEl = document.getElementById("mapCanvas");
    const container = document.getElementById("mapNodesContainer");
    const svg = document.getElementById("mapSvg");
    if (!canvasEl || !container || !svg) return;

    container.innerHTML = "";

    const isPortrait = checkIsPortrait();
    const coords = isPortrait ? COORDS_PORTRAIT : COORDS_WIDE;

    const rect = canvasEl.getBoundingClientRect();
    const canvasW = canvasEl.offsetWidth || rect.width || (isPortrait ? 370 : 800);
    const canvasH = canvasEl.offsetHeight || rect.height || (isPortrait ? 680 : 380);

    const pixelCoords = coords.map(c => ({
      x: Math.round((c.xPct / 100) * canvasW),
      y: Math.round((c.yPct / 100) * canvasH)
    }));

    svg.setAttribute("viewBox", `0 0 ${canvasW} ${canvasH}`);
    svg.setAttribute("width", canvasW);
    svg.setAttribute("height", canvasH);
    svg.removeAttribute("preserveAspectRatio");

    const p0 = pixelCoords[0];
    let pathBaseD = `M ${p0.x} ${p0.y}`;
    let pathClearedD = `M ${p0.x} ${p0.y}`;

    for (let i = 1; i < pixelCoords.length; i++) {
      const prevP = pixelCoords[i - 1];
      const currP = pixelCoords[i];
      let segment = "";
      if (isPortrait) {
        const cpY = (prevP.y + currP.y) / 2;
        segment = ` C ${prevP.x} ${cpY}, ${currP.x} ${cpY}, ${currP.x} ${currP.y}`;
      } else {
        const cpX = (prevP.x + currP.x) / 2;
        segment = ` C ${cpX} ${prevP.y}, ${cpX} ${currP.y}, ${currP.x} ${currP.y}`;
      }
      pathBaseD += segment;
      const prevLv = ch.from + (i - 1);
      const currLv = ch.from + i;
      if (cdh[prevLv] && (cdh[currLv] || (i === currentStageIdx))) {
        pathClearedD += segment;
      }
    }

    svg.innerHTML = `
      <defs>
        <linearGradient id="cyanGlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="100%" stop-color="#818cf8" />
        </linearGradient>
      </defs>
      <path class="path-base" d="${pathBaseD}" />
      <path class="path-cleared" d="${pathClearedD}" />
    `;

    // Spawn 6 Nodes
    ch.levels.forEach((_, i) => {
      const lv = ch.from + i;
      const en = enemyOf(lv);
      const isCleared = !!cdh[lv];
      const isUnlocked = cellOpen && (i === 0 || !!cdh[lv - 1]);
      const isSelected = i === currentStageIdx;
      const isBoss = !!en.boss;
      const c = coords[i];

      const nodeEl = document.createElement("div");
      nodeEl.className = `map-node ${isBoss ? 'boss-node' : ''} ${isSelected ? 'active-node' : ''} ${isCleared ? 'cleared' : ''} ${isUnlocked ? '' : 'locked'}`;
      nodeEl.id = `map-node-${i}`;
      nodeEl.style.left = `${c.xPct}%`;
      nodeEl.style.top = `${c.yPct}%`;

      const stageCode = `STAGE 0${i + 1}`;
      const stageTag = isBoss ? `${stageCode} // BOSS` : stageCode;

      nodeEl.innerHTML = `
        <div class="node-orb-container">
          <div class="node-outer-ring"></div>
          <div class="node-avatar-frame">
            <img class="node-img" src="${en.img}" alt="${en.name}" loading="lazy" onerror="this.src='assets/cards/art/solar-brawler.webp'">
            ${!isUnlocked ? `<div class="node-lock-mask"><span class="ic ic-sm i-lock"></span></div>` : ''}
          </div>
          ${isCleared ? `<span class="sc-node-check-badge">✓</span>` : ''}
          <div class="node-stage-num-tag">${stageTag}</div>
        </div>
      `;

      nodeEl.onclick = () => {
        selectStoryStage(i);
      };

      container.appendChild(nodeEl);
    });
  }

  function updateStoryDrawer() {
    const ch = activeChap();
    const lv = ch.from + currentStageIdx;
    const en = enemyOf(lv);
    const cdh = diffProg()[state.diff];
    const cellOpen = cellUnlocked(ch, state.diff);
    const isUnlocked = cellOpen && (currentStageIdx === 0 || !!cdh[lv - 1]);
    const isCleared = !!cdh[lv];
    const first = !cdh[lv];

    // Stats & Power Gate from Game Core
    const es = typeof enemyStats === "function" ? enemyStats(lv) : { hp: 120, atk: 40 };
    const eHp = es.hp || 0;
    const eAtk = es.atk || 0;
    const reqPower = typeof gateOf === "function" ? gateOf(lv) : (eHp + eAtk);
    const playerPower = typeof totalPower === "function" ? totalPower() : 0;

    const stageCodeEl = document.getElementById("dwStageCode");
    const stageNameEl = document.getElementById("dwStageName");
    const enemyImgEl = document.getElementById("dwEnemyImg");
    const enemyNameEl = document.getElementById("dwEnemyName");

    if (stageCodeEl) {
      stageCodeEl.textContent = `STAGE 0${ch.no}-0${currentStageIdx + 1} // ${en.boss ? 'BOSS GATE' : 'SECTOR COMBAT'}`;
    }
    if (stageNameEl) {
      stageNameEl.textContent = isUnlocked ? en.name : "ENCRYPTED TARGET";
    }
    if (enemyNameEl) {
      enemyNameEl.textContent = isUnlocked ? en.name : "ENCRYPTED";
    }
    if (enemyImgEl) {
      enemyImgEl.src = en.img;
      enemyImgEl.style.filter = isUnlocked ? "none" : "grayscale(100%) brightness(0.4)";
    }

    // Card Reference via en.id && CARDS[en.id]
    const cardRef = (typeof CARDS !== "undefined" && CARDS && en.id && CARDS[en.id])
      ? CARDS[en.id]
      : ((typeof MASTER_CARD_INDEX !== "undefined" && Array.isArray(MASTER_CARD_INDEX))
          ? MASTER_CARD_INDEX.find(c => c.char_id === en.id || c.name === en.name)
          : null);

    const tierEl = document.getElementById("dwTierBadge");
    const typeEl = document.getElementById("dwTypeBadge");

    const tierVal = cardRef ? (cardRef.tier || (en.boss ? "UR" : "R")) : (en.boss ? "UR" : "R");
    const typeVal = cardRef ? (cardRef.type || "OFFENSIVE") : "OFFENSIVE";

    if (tierEl) tierEl.textContent = tierVal;
    if (typeEl) {
      typeEl.innerHTML = `<span class="ic ic-xs ${en.boss ? 'i-dragon' : 'i-swords'}"></span> ${typeVal.toUpperCase()}`;
    }

    // HP & ATK Stats
    const hpEl = document.getElementById("dwEnemyHp");
    const atkEl = document.getElementById("dwEnemyAtk");
    if (hpEl) hpEl.textContent = isUnlocked ? eHp.toLocaleString() : "???";
    if (atkEl) atkEl.textContent = isUnlocked ? eAtk.toLocaleString() : "???";

    // Signature Skill Info via cardRef.passive
    const skillTitleEl = document.getElementById("dwAbilityTitle");
    const skillDescEl = document.getElementById("dwAbilityDesc");

    const skillName = cardRef
      ? (cardRef.passive?.name || cardRef.skill || en.name)
      : (en.boss ? "ANCIENT BOSS WILL" : en.name);
    const skillDesc = cardRef
      ? (cardRef.passive?.desc || cardRef.desc || (en.boss ? "Musuh bos utama bab dengan pertahanan dan serangan luar biasa." : "Unit pertahanan garda depan."))
      : (en.boss ? "Musuh bos utama bab dengan pertahanan dan serangan luar biasa." : "Unit pertahanan garda depan.");

    if (skillTitleEl) {
      skillTitleEl.textContent = isUnlocked ? `SIGNATURE: ${skillName}` : "SIGNATURE: ENCRYPTED";
    }
    if (skillDescEl) {
      skillDescEl.textContent = isUnlocked ? skillDesc : "Intel jurus musuh belum terbuka. Kalahkan stage sebelumnya untuk membongkar taktik lawan.";
    }

    // Combat Readiness Gauge
    const readinessFill = document.getElementById("dwPowerBar");
    const powerDiffBadge = document.getElementById("dwPowerDiffBadge");
    const reqPowerEl = document.getElementById("dwReqPower");
    const playerPowerEl = document.getElementById("dwPlayerPower");

    const powerRatio = reqPower > 0 ? Math.min(100, Math.round((playerPower / reqPower) * 100)) : 100;
    const isReady = playerPower >= reqPower;

    if (readinessFill) readinessFill.style.width = `${powerRatio}%`;
    if (powerDiffBadge) {
      if (isReady) {
        const diffPct = reqPower > 0 ? Math.round(((playerPower - reqPower) / reqPower) * 100) : 100;
        powerDiffBadge.textContent = `UNGGUL +${diffPct}%`;
        powerDiffBadge.className = "readiness-status-badge ready";
      } else {
        const diffPct = reqPower > 0 ? Math.round(((playerPower - reqPower) / reqPower) * 100) : -100;
        powerDiffBadge.textContent = `BAHAYA ${diffPct}%`;
        powerDiffBadge.className = "readiness-status-badge danger";
      }
    }
    if (reqPowerEl) reqPowerEl.textContent = reqPower.toLocaleString();
    if (playerPowerEl) playerPowerEl.textContent = playerPower.toLocaleString();

    // Real Game Rewards
    const coinReward = typeof firstClearReward === "function" ? firstClearReward(lv) : (en.boss ? 50000 : 10000);
    const gemReward = typeof storyGemPreview === "function" ? storyGemPreview(lv) : 0;
    const cdLeft = first ? 0 : (typeof storyCdLeft === "function" ? storyCdLeft(lv) : 0);

    const rewardCoinEl = document.getElementById("dwRewardCoin");
    const rewardGemEl = document.getElementById("dwRewardGem");
    const gemBox = document.getElementById("dwGemBox");
    const rwLblEl = document.getElementById("dwRwLbl");
    const cdBadge = document.getElementById("dwCdBadge");

    if (rewardCoinEl) rewardCoinEl.textContent = `+${coinReward.toLocaleString()} COINS`;
    if (rewardGemEl) rewardGemEl.textContent = `+${gemReward} GEMS`;
    if (gemBox) gemBox.style.display = gemReward > 0 ? "flex" : "none";
    if (rwLblEl) rwLblEl.textContent = first ? "FIRST CLEAR REWARD" : "REPEAT REWARD";

    if (cdBadge) {
      if (!first && cdLeft > 0) {
        cdBadge.style.display = "block";
        cdBadge.textContent = typeof storyCdText === "function" ? storyCdText(cdLeft) : `CD: ${cdLeft}s`;
      } else {
        cdBadge.style.display = "none";
      }
    }

    // Deploy CTA Button
    const deployBtn = document.getElementById("btnDeploy") || document.getElementById("scStartBattleBtn");
    if (deployBtn) {
      deployBtn.dataset.cdRepeat = (isUnlocked && !first && cdLeft > 0) ? "1" : "";
      if (!isUnlocked) {
        deployBtn.disabled = true;
        deployBtn.className = "btn-launch-battle";
        deployBtn.innerHTML = `<span class="ic ic-sm i-lock"></span> TERKUNCI`;
      } else if (!first && cdLeft > 0) {
        deployBtn.disabled = true;
        deployBtn.className = "btn-launch-battle";
        deployBtn.innerHTML = `<span class="ic ic-sm i-bolt"></span> ${typeof storyCdText === "function" ? storyCdText(cdLeft) : "COOLDOWN"}`;
      } else {
        deployBtn.disabled = false;
        deployBtn.className = en.boss ? "btn-launch-battle boss-deploy" : "btn-launch-battle";
        deployBtn.innerHTML = `<span class="ic ic-sm ${en.boss ? 'i-dragon' : 'i-swords'}"></span> ${en.boss ? 'DEPLOY BOSS RAID' : 'MASUK PERTEMPURAN'}`;
      }
    }

    // Mobile Quick Dock
    const mqImg = document.getElementById("mqEnemyImg");
    const mqCode = document.getElementById("mqStageCode");
    const mqName = document.getElementById("mqEnemyName");
    const btnMqDeploy = document.getElementById("btnMqDeploy");

    if (mqImg) mqImg.src = en.img;
    if (mqCode) mqCode.textContent = `STAGE 0${ch.no}-0${currentStageIdx + 1}`;
    if (mqName) mqName.textContent = isUnlocked ? en.name : "TERKUNCI";
    if (btnMqDeploy) {
      btnMqDeploy.disabled = !isUnlocked || (!first && cdLeft > 0);
      btnMqDeploy.className = en.boss ? "btn-mq-deploy boss-deploy" : "btn-mq-deploy";
      btnMqDeploy.innerHTML = `<span class="ic ic-xs ${en.boss ? 'i-dragon' : 'i-swords'}"></span> ${isUnlocked ? (en.boss ? 'BOSS' : 'BATTLE') : 'KUNCI'}`;
    }
  }

  function selectStoryStage(idx) {
    if (idx === currentStageIdx) return;
    if (window.sfx && sfx.hit) sfx.hit();
    currentStageIdx = idx;

    // Update active class on nodes
    const ch = activeChap();
    ch.levels.forEach((_, i) => {
      const nodeEl = document.getElementById(`map-node-${i}`);
      if (nodeEl) nodeEl.classList.toggle("active-node", i === currentStageIdx);
    });

    updateStoryDrawer();
  }

  function slideStoryStage(dir) {
    const ch = activeChap();
    const next = currentStageIdx + dir;
    if (next < 0 || next >= ch.levels.length) return;
    selectStoryStage(next);
  }

  function openBottomSheet() {
    if (window.sfx && sfx.hit) sfx.hit();
    const drawer = document.getElementById("stageBriefingDrawer");
    if (drawer) drawer.classList.add("expanded-sheet");
  }

  function closeDrawerOrSheet() {
    const drawer = document.getElementById("stageBriefingDrawer");
    if (drawer) drawer.classList.remove("expanded-sheet");
  }

  function openLoreModal() {
    if (window.sfx && sfx.hit) sfx.hit();
    const ch = activeChap();
    const overlay = document.getElementById("loreModal");
    const title = document.getElementById("loreModalTitle");
    const content = document.getElementById("loreModalBody");

    const chapNames = {"1":"DESA LEMBAH NINJA","2":"ORBIT PLANET HIJAU","3":"KORIDOR STASIUN SHIBUYA","4":"MUSHIMA TOWN","5":"ISTANA INFINITE TSUDZUMI"};
    const cName = chapNames[ch.no] || ch.zone || `BAB 0${ch.no}`;

    if (title) title.innerHTML = `<span class="ic ic-md i-scroll"></span> DOSSIER ARSIP: BAB 0${ch.no} · ${cName}`;
    if (content) {
      if (Array.isArray(ch.lore) && ch.lore.length) {
        content.innerHTML = ch.lore.map(p => `<p class="lore-paragraph">${p}</p>`).join("");
      } else {
        content.innerHTML = `<p class="lore-paragraph">Arsip catatan bab ini telah terenkripsi dalam memori sistem.</p>`;
      }
    }
    if (overlay) overlay.classList.add("open");
  }

  function closeLoreModal() {
    const overlay = document.getElementById("loreModal");
    if (overlay) overlay.classList.remove("open");
  }

  function launchSelectedBattle() {
    const ch = activeChap();
    const lv = ch.from + currentStageIdx;
    const cdh = diffProg()[state.diff];
    const cellOpen = cellUnlocked(ch, state.diff);
    const isUnlocked = cellOpen && (currentStageIdx === 0 || !!cdh[lv - 1]);

    if (!isUnlocked) {
      if (window.sfx && sfx.lose) sfx.lose();
      try {
        const reqStage = currentStageIdx;
        toast("TERKUNCI", `Selesaikan Stage 0${reqStage} terlebih dahulu!`, "#ff4b5a");
      } catch(e) {}
      return;
    }

    const first = !cdh[lv];
    const cdLeft = first ? 0 : (typeof storyCdLeft === "function" ? storyCdLeft(lv) : 0);
    if (!first && cdLeft > 0) {
      if (window.sfx && sfx.lose) sfx.lose();
      try {
        toast("COOLDOWN", `Replay stage ini masih menunggu waktu jeda!`, "#ff4b5a");
      } catch(e) {}
      return;
    }

    if (window.sfx && sfx.hit) sfx.hit();
    closeStory();

    // Call real game battle launch
    if (typeof startStoryBattle === "function") {
      startStoryBattle(lv);
    } else if (typeof battleStage === "function") {
      battleStage(lv);
    }
  }

  // Export to global scope
  window.openStoryCarousel = openStory;
  window.openStory = openStory;
  window.closeStory = closeStory;
  window.closeStoryCarousel = closeStory;
  window.openMission = () => openStory();
  window.selectStoryStage = selectStoryStage;
  window.slideStoryStage = slideStoryStage;
  window.changeStoryChapter = changeStoryChapter;
  window.initStoryCarousel = initStoryCarousel;
  window.startAmbientLoop = startAmbientLoop;
  window.stopAmbientLoop = stopAmbientLoop;
  window.battleStage = (lv) => {
    if (typeof startStoryBattle === "function") startStoryBattle(lv);
  };
})();
