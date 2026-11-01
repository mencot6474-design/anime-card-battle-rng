/* ==========================================================================
   STORY-CAROUSEL.JS — TACTICAL NODE MAP STORY SYSTEM (LOCAL INTEGRATION)
   ========================================================================== */

(function(){
  let currentStageIdx = 0; // index inside current chapter levels (0..5)
  let boundGestures = false;

  // Responsive Node Coordinates
  // Wide / Landscape: horizontal wave across container
  const COORDS_WIDE = [
    { xPct: 10, yPct: 62 },
    { xPct: 26, yPct: 32 },
    { xPct: 42, yPct: 62 },
    { xPct: 58, yPct: 32 },
    { xPct: 74, yPct: 62 },
    { xPct: 90, yPct: 38 }  // Boss Node
  ];

  // Mobile Portrait: vertical S-curve flowing top to bottom
  const COORDS_PORTRAIT = [
    { xPct: 26, yPct: 10 },
    { xPct: 74, yPct: 25 },
    { xPct: 26, yPct: 40 },
    { xPct: 74, yPct: 55 },
    { xPct: 28, yPct: 70 },
    { xPct: 50, yPct: 86 }  // Boss Node
  ];

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

      window.addEventListener("resize", () => {
        const modal = document.getElementById("storyModal");
        if (modal && modal.classList.contains("show")) {
          renderTacticalNodes();
        }
      });
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

      buildStoryChapterDOM();
      const modal = document.getElementById("storyModal");
      if (modal) modal.classList.add("show");
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

    const rect = canvasEl.getBoundingClientRect();
    const isPortrait = window.innerWidth <= 600 || (rect.width > 0 && rect.width <= 480);
    const coords = isPortrait ? COORDS_PORTRAIT : COORDS_WIDE;

    const canvasW = canvasEl.offsetWidth || rect.width || (isPortrait ? 360 : 750);
    const canvasH = canvasEl.offsetHeight || rect.height || (isPortrait ? 600 : 340);

    const pixelCoords = coords.map(c => ({
      x: Math.round((c.xPct / 100) * canvasW),
      y: Math.round((c.yPct / 100) * canvasH)
    }));

    // Build SVG Connecting Paths
    let pathBaseD = `M ${pixelCoords[0].x} ${pixelCoords[0].y}`;
    let pathClearedD = `M ${pixelCoords[0].x} ${pixelCoords[0].y}`;

    for (let i = 1; i < pixelCoords.length; i++) {
      const p0 = pixelCoords[i - 1];
      const p1 = pixelCoords[i];
      let segment = "";
      if (isPortrait) {
        const cpY = (p0.y + p1.y) / 2;
        segment = ` C ${p0.x} ${cpY}, ${p1.x} ${cpY}, ${p1.x} ${p1.y}`;
      } else {
        const cpX = (p0.x + p1.x) / 2;
        segment = ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
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
      const p = pixelCoords[i];

      const nodeEl = document.createElement("div");
      nodeEl.className = `sc-node ${isBoss ? 'is-boss' : ''} ${isSelected ? 'active' : ''} ${isCleared ? 'cleared' : ''} ${isUnlocked ? '' : 'locked'}`;
      nodeEl.id = `sc-node-${i}`;
      nodeEl.style.left = `${p.x}px`;
      nodeEl.style.top = `${p.y}px`;

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
    const cdh = diffProg()[state.diff];
    const cellOpen = cellUnlocked(ch, state.diff);

    const lv = ch.from + currentStageIdx;
    const en = enemyOf(lv);
    const cardData = (en.id && CARDS[en.id]) ? CARDS[en.id] : null;
    const tier = cardData ? cardData.tier : (en.boss ? "UR" : "R");
    const skill = cardData && cardData.skill ? cardData.skill : (en.skill || "IMPACT STRIKE");
    const desc = cardData && cardData.desc ? cardData.desc : (en.desc || "Serangan jurus lawan.");
    const type = cardData && cardData.type ? cardData.type : (en.boss ? "Offensive" : "Balanced");

    const g = gateOf(lv);
    const pw = totalPower();
    const ok = pw >= g;
    const bar = Math.max(4, Math.min(100, Math.round((pw / g) * 100)));
    const diffPct = Math.round(((pw - g) / g) * 100);

    const first = !cdh[lv];
    const reward = first ? firstClearReward(lv) : Math.round(firstClearReward(lv) * 0.2);
    const cdLeft = first ? 0 : (typeof storyCdLeft === "function" ? storyCdLeft(lv) : 0);
    const isUnlocked = cellOpen && (currentStageIdx === 0 || !!cdh[lv - 1]);

    // Drawer Header & Target Card
    const stageNum = document.getElementById("scDockStageNum");
    const enemyName = document.getElementById("scDockEnemyName");
    const targetTitle = document.getElementById("scDockTargetTitle");
    const enemyImg = document.getElementById("scDockEnemyImg");
    const tierPill = document.getElementById("scDockTier");
    const typePill = document.getElementById("scDockType");
    const statusPill = document.getElementById("scDockStatusPill");
    const hpVal = document.getElementById("scDockHp");
    const atkVal = document.getElementById("scDockAtk");

    if (stageNum) stageNum.textContent = en.boss ? `STAGE 0${currentStageIdx + 1} // BOSS GATE` : `STAGE 0${currentStageIdx + 1} // TACTICAL STAGE`;
    if (enemyName) enemyName.textContent = isUnlocked ? en.name : `STAGE 0${currentStageIdx + 1} TERKUNCI`;
    if (targetTitle) targetTitle.textContent = isUnlocked ? en.name : "ENCRYPTED TARGET";
    if (enemyImg) enemyImg.src = en.img;

    if (tierPill) tierPill.textContent = tier;
    if (typePill) typePill.innerHTML = `<span class="ic ic-xs ${en.boss ? 'i-dragon' : 'i-swords'}"></span> ${type.toUpperCase()}`;

    if (statusPill) {
      if (!isUnlocked) {
        statusPill.className = "sc-status-pill locked";
        statusPill.innerHTML = `<span class="ic ic-xs i-lock"></span> TERKUNCI`;
      } else if (!first) {
        statusPill.className = "sc-status-pill cleared";
        statusPill.innerHTML = `<span class="ic ic-xs i-check"></span> SELESAI`;
      } else {
        statusPill.className = "sc-status-pill ready";
        statusPill.innerHTML = `SIAP TEMPUR`;
      }
    }

    if (hpVal) hpVal.textContent = isUnlocked ? fmt(en.hp) : "???";
    if (atkVal) atkVal.textContent = isUnlocked ? fmt(en.atk) : "???";

    // Ability Intel
    const skillTitle = document.getElementById("scDockSkillTitle");
    const skillDesc = document.getElementById("scDockSkillDesc");
    if (skillTitle) skillTitle.textContent = isUnlocked ? `JURUS: ${skill}` : "JURUS RAHASIA";
    if (skillDesc) skillDesc.textContent = isUnlocked ? desc : `Selesaikan Stage 0${currentStageIdx} untuk membedah jurus rahasia lawan.`;

    // Power Readiness
    const powerStatus = document.getElementById("scDockPowerStatus");
    const gateVal = document.getElementById("scDockGateVal");
    const barFill = document.getElementById("scDockBarFill");

    if (powerStatus) {
      if (!isUnlocked) {
        powerStatus.textContent = "TERKUNCI";
        powerStatus.style.color = "var(--neon-crimson)";
      } else if (ok) {
        powerStatus.textContent = `UNGGUL +${diffPct}%`;
        powerStatus.style.color = "var(--neon-emerald)";
      } else {
        powerStatus.textContent = `KURANG ${diffPct}%`;
        powerStatus.style.color = "var(--neon-crimson)";
      }
    }

    if (gateVal) {
      if (!isUnlocked) {
        gateVal.innerHTML = `<span style="color:var(--neon-crimson)">STAGE MASIH TERKUNCI</span>`;
      } else {
        gateVal.innerHTML = `REQ <b>${fmt(g)}</b> / KAMU <b>${fmt(pw)}</b>`;
      }
    }

    if (barFill) {
      if (!isUnlocked) {
        barFill.style.width = "0%";
      } else {
        barFill.style.width = `${bar}%`;
        barFill.style.background = ok ? 'linear-gradient(90deg, #10b981, #38bdf8)' : 'linear-gradient(90deg, #f43f5e, #fb7185)';
      }
    }

    // Rewards
    const rewardVal = document.getElementById("scDockRewardVal");
    const rewardLbl = document.getElementById("scDockRwLbl");
    const gemVal = document.getElementById("scDockRewardGem");
    const gemN = (typeof storyGemPreview === "function" && isUnlocked) ? storyGemPreview(lv) : 0;

    if (rewardLbl) rewardLbl.textContent = first ? "HADIAH FIRST CLEAR" : "HADIAH REPLAY (20%)";
    if (rewardVal) rewardVal.textContent = isUnlocked ? `◎ ${fmt(reward)} Gold` : "—";
    if (gemVal) gemVal.textContent = isUnlocked ? `+${gemN} Gems` : "—";

    // Cooldown badge
    const cdBadge = document.getElementById("scDockCd");
    if (cdBadge) {
      const showCd = isUnlocked && !first && cdLeft > 0;
      cdBadge.style.display = showCd ? "inline-flex" : "none";
      cdBadge.textContent = showCd ? `REPLAY COOLDOWN · ${typeof storyCdText === "function" ? storyCdText(cdLeft) : ""}` : "";
    }

    // Launch Button
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
    if (drawer) drawer.classList.add("expanded");
  }

  function closeDrawerOrSheet() {
    const drawer = document.getElementById("scBriefingDrawer");
    if (drawer) drawer.classList.remove("expanded");
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
