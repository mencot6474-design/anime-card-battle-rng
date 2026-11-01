/* ==========================================================================
   STORY-CAROUSEL.JS — TACTICAL NODE MAP STORY SYSTEM (LOCAL INTEGRATION)
   ========================================================================== */

(function(){
  let currentStageIdx = 0; // index inside current chapter levels (0..5)
  let boundGestures = false;
  let canvasResizeObserver = null;

  // Responsive Node Coordinates
  // Wide / Landscape: horizontal wave across container with plenty of bottom margin
  const COORDS_WIDE = [
    { xPct: 8,  yPct: 50 },
    { xPct: 24, yPct: 34 },
    { xPct: 40, yPct: 50 },
    { xPct: 56, yPct: 34 },
    { xPct: 72, yPct: 50 },
    { xPct: 88, yPct: 40 }  // Boss Node
  ];

  // Mobile Portrait: vertical S-curve placed in safe area (8% to 70%), never obstructed by dock
  const COORDS_PORTRAIT = [
    { xPct: 28, yPct: 8  },
    { xPct: 72, yPct: 20 },
    { xPct: 28, yPct: 32 },
    { xPct: 72, yPct: 44 },
    { xPct: 28, yPct: 56 },
    { xPct: 50, yPct: 70 }  // Boss Node
  ];

  function checkIsPortrait() {
    const canvasEl = document.getElementById("scMapCanvas");
    if (canvasEl && canvasEl.offsetWidth > 0 && canvasEl.offsetHeight > 0) {
      return canvasEl.offsetHeight > canvasEl.offsetWidth || canvasEl.offsetWidth <= 560;
    }
    return window.matchMedia("(orientation: portrait)").matches || window.innerWidth <= 640;
  }

  function initStoryCarousel() {
    const prevBtn = document.getElementById("scPrevChap");
    const nextBtn = document.getElementById("scNextChap");
    const battleBtn = document.getElementById("scBtnBattle");
    const mqDeployBtn = document.getElementById("scMqDeployBtn");
    const closeBtn = document.getElementById("smClose");
    const drawerCloseBtn = document.getElementById("scDrawerClose");
    const mqExpandBtn = document.getElementById("scMqExpandBtn");
    const mobileDock = document.getElementById("scMobileDock");
    const loreBtn = document.getElementById("scBtnLore");
    const loreCloseBtn = document.getElementById("scLoreClose");

    if (prevBtn) prevBtn.onclick = () => { if (window.sfx && sfx.hit) sfx.hit(); changeStoryChapter(-1); };
    if (nextBtn) nextBtn.onclick = () => { if (window.sfx && sfx.hit) sfx.hit(); changeStoryChapter(1); };

    if (battleBtn) {
      battleBtn.onclick = () => {
        launchSelectedBattle();
      };
    }
    if (mqDeployBtn) {
      mqDeployBtn.onclick = (e) => {
        e.stopPropagation();
        launchSelectedBattle();
      };
    }

    if (closeBtn) {
      closeBtn.onclick = () => {
        if (window.sfx && sfx.hit) sfx.hit();
        closeStory();
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

    if (loreBtn) {
      loreBtn.onclick = () => {
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
          const lore = document.getElementById("scLoreOverlay");
          if (lore && lore.classList.contains("open")) {
            closeLoreModal();
          } else {
            closeStory();
          }
        }
      });

      const handleResize = () => {
        const modal = document.getElementById("storyModal");
        if (modal && modal.classList.contains("show")) {
          renderTacticalNodes();
        }
      };

      window.addEventListener("resize", handleResize);
      try {
        window.matchMedia("(orientation: portrait)").addEventListener("change", handleResize);
      } catch(e) {}
    }

    // Attach ResizeObserver to canvas if available
    const canvasEl = document.getElementById("scMapCanvas");
    if (canvasEl && window.ResizeObserver && !canvasResizeObserver) {
      canvasResizeObserver = new ResizeObserver(() => {
        const modal = document.getElementById("storyModal");
        if (modal && modal.classList.contains("show")) {
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

      // Trigger crisp layout pass once modal display is active
      requestAnimationFrame(() => {
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
    if (modal) modal.classList.remove("show");
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

    // Reset to first uncleared stage in new chapter
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
    const chapTitleEl = document.getElementById("scChapTitle");
    if (chapTitleEl) {
      chapTitleEl.textContent = `BAB 0${ch.no} · ${ch.zone}`;
    }

    // Prev / Next Chapter Buttons
    const prevBtn = document.getElementById("scPrevChap");
    const nextBtn = document.getElementById("scNextChap");
    if (prevBtn) prevBtn.disabled = currentChapNo <= 1;
    if (nextBtn) nextBtn.disabled = currentChapNo >= CHAPTERS.length;

    // Render Difficulty Pills
    const diffGroup = document.getElementById("scDiffGroup");
    const diffBadge = document.getElementById("scDiffBadge");
    if (diffBadge) diffBadge.textContent = state.diff.toUpperCase();

    if (diffGroup && typeof DIFFS !== "undefined" && DIFFS) {
      diffGroup.innerHTML = DIFFS.map(d => {
        const unl = cellUnlocked(ch, d.k);
        const on = d.k === state.diff;
        return `<button class="btn-sc-diff${on ? ' active' : ''}${unl ? '' : ' locked'}" data-d="${d.k}" ${unl ? '' : 'disabled'}>${d.l}</button>`;
      }).join("");

      diffGroup.querySelectorAll(".btn-sc-diff").forEach(b => {
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

    const progTxt = document.getElementById("scChapProgressTxt");
    const progFill = document.getElementById("scChapProgressFill");
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

    const canvasEl = document.getElementById("scMapCanvas");
    const container = document.getElementById("scMapNodes");
    const svg = document.getElementById("scMapSvg");
    if (!canvasEl || !container || !svg) return;

    container.innerHTML = "";

    const isPortrait = checkIsPortrait();
    const coords = isPortrait ? COORDS_PORTRAIT : COORDS_WIDE;

    // SVG Configuration: 0 0 1000 1000 percentage coordinate space
    svg.setAttribute("viewBox", "0 0 1000 1000");
    svg.setAttribute("preserveAspectRatio", "none");

    // Build SVG Connecting Paths mathematically mapped to node percentage coordinates
    const p0 = { x: coords[0].xPct * 10, y: coords[0].yPct * 10 };
    let pathBaseD = `M ${p0.x} ${p0.y}`;
    let pathClearedD = `M ${p0.x} ${p0.y}`;

    for (let i = 1; i < coords.length; i++) {
      const prevP = { x: coords[i - 1].xPct * 10, y: coords[i - 1].yPct * 10 };
      const currP = { x: coords[i].xPct * 10, y: coords[i].yPct * 10 };
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
        <linearGradient id="scCyanGlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="100%" stop-color="#818cf8" />
        </linearGradient>
      </defs>
      <path class="sc-path-base" d="${pathBaseD}" />
      <path class="sc-path-cleared" d="${pathClearedD}" />
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
      nodeEl.className = `sc-node ${isBoss ? 'is-boss' : ''} ${isSelected ? 'active' : ''} ${isCleared ? 'cleared' : ''} ${isUnlocked ? '' : 'locked'}`;
      nodeEl.id = `sc-node-${i}`;
      // Sub-pixel percentage positioning: exactly coincident with SVG path points
      nodeEl.style.left = `${c.xPct}%`;
      nodeEl.style.top = `${c.yPct}%`;

      let statusBadgeHtml = "";
      if (isBoss) {
        statusBadgeHtml = `<span class="sc-node-tag boss"><span class="ic ic-xs i-dragon"></span> BOSS</span>`;
      } else if (isCleared) {
        statusBadgeHtml = `<span class="sc-node-tag cleared"><span class="ic ic-xs i-check"></span> SELESAI</span>`;
      } else if (isUnlocked) {
        statusBadgeHtml = `<span class="sc-node-tag ready">SIAP</span>`;
      } else {
        statusBadgeHtml = `<span class="sc-node-tag locked"><span class="ic ic-xs i-lock"></span> KUNCI</span>`;
      }

      nodeEl.innerHTML = `
        <div class="sc-node-orb">
          <div class="sc-node-ring"></div>
          <div class="sc-node-avatar">
            <img class="sc-node-img" src="${en.img}" alt="${en.name}" loading="lazy" onerror="this.src='assets/cards/art/solar-brawler.webp'">
            ${!isUnlocked ? `<div class="sc-node-lock-mask"><span class="ic ic-sm i-lock"></span></div>` : ''}
          </div>
          <div class="sc-node-num">0${i + 1}</div>
        </div>
        <div class="sc-node-meta">
          <div class="sc-node-name">${isUnlocked ? en.name : 'ENCRYPTED'}</div>
          ${statusBadgeHtml}
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
    const reqPower = gateOf(lv);
    const playerPower = totalPower();

    // Stage Number & Enemy Name
    const stageNumEl = document.getElementById("scDockStageNum");
    const enemyNameEl = document.getElementById("scDockEnemyName");
    const targetTitleEl = document.getElementById("scDockTargetTitle");
    const enemyImgEl = document.getElementById("scDockEnemyImg");

    if (stageNumEl) {
      stageNumEl.textContent = `STAGE 0${currentStageIdx + 1} // ${en.boss ? 'BOSS THREAT' : 'SECTOR COMBAT'}`;
    }
    if (enemyNameEl) {
      enemyNameEl.textContent = isUnlocked ? en.name : "ENCRYPTED TARGET";
    }
    if (targetTitleEl) {
      targetTitleEl.textContent = isUnlocked ? en.name : "LOCKED INTEL";
    }
    if (enemyImgEl) {
      enemyImgEl.src = en.img;
      enemyImgEl.style.filter = isUnlocked ? "none" : "grayscale(100%) brightness(0.4)";
    }

    // Card Reference & Tier / Type
    const cardRef = typeof CARDS !== "undefined" && CARDS ? CARDS.find(c => c.name === en.name || c.id === en.id) : null;
    const tierEl = document.getElementById("scDockTier");
    const typeEl = document.getElementById("scDockType");
    const statusPillEl = document.getElementById("scDockStatusPill");

    const tierVal = cardRef ? cardRef.tier : (en.boss ? "UR" : "R");
    const typeVal = cardRef ? cardRef.type : "OFFENSIVE";

    if (tierEl) tierEl.textContent = tierVal;
    if (typeEl) typeEl.textContent = typeVal.toUpperCase();

    if (statusPillEl) {
      if (isCleared) {
        statusPillEl.className = "sc-status-pill cleared";
        statusPillEl.textContent = "✓ CLEARED";
      } else if (isUnlocked) {
        statusPillEl.className = "sc-status-pill ready";
        statusPillEl.textContent = "SIAP TEMPUR";
      } else {
        statusPillEl.className = "sc-status-pill locked";
        statusPillEl.textContent = "🔒 TERKUNCI";
      }
    }

    // HP & ATK Stats
    const hpEl = document.getElementById("scDockHp");
    const atkEl = document.getElementById("scDockAtk");
    if (hpEl) hpEl.textContent = isUnlocked ? (en.hp || 0).toLocaleString() : "???";
    if (atkEl) atkEl.textContent = isUnlocked ? (en.atk || 0).toLocaleString() : "???";

    // Signature Skill Info
    const skillTitleEl = document.getElementById("scDockSkillTitle");
    const skillDescEl = document.getElementById("scDockSkillDesc");
    if (skillTitleEl) {
      skillTitleEl.textContent = isUnlocked ? (cardRef ? (cardRef.skill || "SIGNATURE SKILL") : (en.boss ? "ANCIENT BOSS WILL" : "COMBAT DRILL")) : "ENCRYPTED SKILL";
    }
    if (skillDescEl) {
      skillDescEl.textContent = isUnlocked ? (cardRef ? (cardRef.desc || "Tidak ada data pasif khusus.") : (en.boss ? "Musuh tingkat tinggi dengan pertahanan kuat." : "Unit patroli garda depan.")) : "Intel jurus musuh belum terbuka. Kalahkan stage sebelumnya untuk membongkar taktik lawan.";
    }

    // Combat Readiness Gauge
    const readinessFill = document.getElementById("scDockBarFill");
    const powerStatusEl = document.getElementById("scDockPowerStatus");
    const gateValEl = document.getElementById("scDockGateVal");

    const powerRatio = reqPower > 0 ? Math.min(100, Math.round((playerPower / reqPower) * 100)) : 100;
    const isReady = playerPower >= reqPower;

    if (readinessFill) readinessFill.style.width = `${powerRatio}%`;
    if (powerStatusEl) {
      powerStatusEl.textContent = isReady ? "SIAP TEMPUR" : "BAHAYA (UNDERPOWER)";
      powerStatusEl.className = `sc-rd-status ${isReady ? 'ready' : 'danger'}`;
    }
    if (gateValEl) {
      gateValEl.textContent = `DECK ${playerPower.toLocaleString()} / REQ ${reqPower.toLocaleString()}`;
    }

    // Real Game Rewards
    const rewardValEl = document.getElementById("scDockRewardVal");
    const rewardGemEl = document.getElementById("scDockRewardGem");
    const rwLblEl = document.getElementById("scDockRwLbl");
    const cdEl = document.getElementById("scDockCd");

    const coinReward = typeof firstClearReward === "function" ? firstClearReward(lv) : (en.boss ? 50000 : 10000);
    const gemReward = typeof storyGemPreview === "function" ? storyGemPreview(lv) : 0;
    const cdLeft = first ? 0 : (typeof storyCdLeft === "function" ? storyCdLeft(lv) : 0);

    if (rewardValEl) rewardValEl.textContent = `◎ ${coinReward.toLocaleString()}`;
    if (rewardGemEl) {
      rewardGemEl.textContent = `+${gemReward} Gems`;
      rewardGemEl.parentElement.style.display = gemReward > 0 ? "flex" : "none";
    }
    if (rwLblEl) rwLblEl.textContent = first ? "FIRST CLEAR REWARD" : "REPEAT REWARD";

    if (cdEl) {
      if (!first && cdLeft > 0) {
        cdEl.style.display = "inline-flex";
        cdEl.textContent = typeof storyCdText === "function" ? storyCdText(cdLeft) : `CD: ${cdLeft}s`;
      } else {
        cdEl.style.display = "none";
      }
    }

    // Launch Battle Button
    const battleBtn = document.getElementById("scBtnBattle");
    if (battleBtn) {
      battleBtn.dataset.cdRepeat = (isUnlocked && !first && cdLeft > 0) ? "1" : "";
      if (!isUnlocked) {
        battleBtn.disabled = true;
        battleBtn.className = "sc-btn-battle-launch";
        battleBtn.innerHTML = `<span class="ic ic-sm i-lock"></span> TERKUNCI`;
      } else if (!first && cdLeft > 0) {
        battleBtn.disabled = true;
        battleBtn.className = "sc-btn-battle-launch";
        battleBtn.innerHTML = `<span class="ic ic-sm i-bolt"></span> ${typeof storyCdText === "function" ? storyCdText(cdLeft) : "COOLDOWN"}`;
      } else {
        battleBtn.disabled = false;
        battleBtn.className = en.boss ? "sc-btn-battle-launch boss" : "sc-btn-battle-launch";
        battleBtn.innerHTML = `<span class="ic ic-sm ${en.boss ? 'i-dragon' : 'i-swords'}"></span> ${en.boss ? 'DEPLOY BOSS RAID' : 'MULAI BATTLE'}`;
      }
    }

    // Mobile Quick Dock
    const mqImg = document.getElementById("scMqImg");
    const mqCode = document.getElementById("scMqCode");
    const mqName = document.getElementById("scMqName");
    const mqDeploy = document.getElementById("scMqDeployBtn");

    if (mqImg) mqImg.src = en.img;
    if (mqCode) mqCode.textContent = `STAGE 0${currentStageIdx + 1}`;
    if (mqName) mqName.textContent = isUnlocked ? en.name : "TERKUNCI";
    if (mqDeploy) {
      mqDeploy.disabled = !isUnlocked || (!first && cdLeft > 0);
      mqDeploy.innerHTML = `<span class="ic ic-xs i-swords"></span> ${isUnlocked ? 'BATTLE' : 'KUNCI'}`;
    }
  }

  function selectStoryStage(idx) {
    if (idx === currentStageIdx) return;
    if (window.sfx && sfx.hit) sfx.hit();
    currentStageIdx = idx;

    // Update active class on nodes
    const ch = activeChap();
    ch.levels.forEach((_, i) => {
      const nodeEl = document.getElementById(`sc-node-${i}`);
      if (nodeEl) nodeEl.classList.toggle("active", i === currentStageIdx);
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
    const drawer = document.getElementById("scBriefingDrawer");
    if (drawer) {
      drawer.classList.add("expanded");
      drawer.classList.add("open");
    }
  }

  function closeDrawerOrSheet() {
    const drawer = document.getElementById("scBriefingDrawer");
    if (drawer) {
      drawer.classList.remove("expanded");
      drawer.classList.remove("open");
    }
  }

  function openLoreModal() {
    if (window.sfx && sfx.hit) sfx.hit();
    const ch = activeChap();
    const overlay = document.getElementById("scLoreOverlay");
    const title = document.getElementById("scLoreTitle");
    const content = document.getElementById("scLoreContent");

    if (title) title.textContent = `ARSIP CERITA: BAB 0${ch.no} · ${ch.zone}`;
    if (content) {
      if (Array.isArray(ch.lore) && ch.lore.length) {
        content.innerHTML = ch.lore.map(p => `<p>${p}</p>`).join("");
      } else {
        content.innerHTML = `<p>Arsip catatan bab ini telah terenkripsi dalam memori sistem.</p>`;
      }
    }
    if (overlay) overlay.classList.add("open");
  }

  function closeLoreModal() {
    const overlay = document.getElementById("scLoreOverlay");
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
    startStoryBattle(lv);
  }

  // Export to global scope
  window.openStoryCarousel = openStory;
  window.openStory = openStory;
  window.closeStory = closeStory;
  window.openMission = () => openStory();
  window.selectStoryStage = selectStoryStage;
  window.slideStoryStage = slideStoryStage;
  window.changeStoryChapter = changeStoryChapter;
  window.initStoryCarousel = initStoryCarousel;
})();
