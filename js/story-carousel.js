/* ==========================================================================
   STORY-CAROUSEL.JS — 3D COVERFLOW STORY CAMPAIGN ENGINE (LOCAL INTEGRATION)
   ========================================================================== */

(function(){
  let currentStageIdx = 0; // index inside current chapter levels (0..5)
  let boundGestures = false;

  function initStoryCarousel() {
    const prevBtn = document.getElementById("scPrevChap");
    const nextBtn = document.getElementById("scNextChap");
    const prevStg = document.getElementById("scPrevStage");
    const nextStg = document.getElementById("scNextStage");
    const battleBtn = document.getElementById("scBtnBattle");
    const closeBtn = document.getElementById("smClose");

    if (prevBtn) prevBtn.onclick = () => { if (window.sfx && sfx.hit) sfx.hit(); changeStoryChapter(-1); };
    if (nextBtn) nextBtn.onclick = () => { if (window.sfx && sfx.hit) sfx.hit(); changeStoryChapter(1); };
    if (prevStg) prevStg.onclick = () => { slideStoryStage(-1); };
    if (nextStg) nextStg.onclick = () => { slideStoryStage(1); };

    if (battleBtn) {
      battleBtn.onclick = () => {
        launchSelectedBattle();
      };
    }

    if (closeBtn) {
      closeBtn.onclick = () => {
        if (window.sfx && sfx.hit) sfx.hit();
        closeStory();
      };
    }

    // Bind keyboard and gestures once
    if (!boundGestures) {
      boundGestures = true;
      window.addEventListener("keydown", (e) => {
        const modal = document.getElementById("storyModal");
        if (!modal || !modal.classList.contains("show")) return;
        if (e.key === "ArrowLeft") slideStoryStage(-1);
        if (e.key === "ArrowRight") slideStoryStage(1);
        if (e.key === "Escape") closeStory();
      });

      const stageEl = document.getElementById("scCarouselStage");
      if (stageEl) {
        let touchStartX = 0;
        stageEl.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
        stageEl.addEventListener("touchend", e => {
          const diffX = e.changedTouches[0].clientX - touchStartX;
          if (Math.abs(diffX) > 40) {
            if (diffX > 0) slideStoryStage(-1);
            else slideStoryStage(1);
          }
        }, { passive: true });

        stageEl.addEventListener("wheel", (e) => {
          const modal = document.getElementById("storyModal");
          if (!modal || !modal.classList.contains("show")) return;
          e.preventDefault();
          if (e.deltaY > 20) slideStoryStage(1);
          else if (e.deltaY < -20) slideStoryStage(-1);
        }, { passive: false });
      }
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
      document.getElementById("storyModal").classList.add("show");
    } catch(err) {
      console.error("openStory error:", err);
      try { toast("STORY ERROR", (err && err.message) || "gagal membuka cerita", "#ff5c5c"); } catch(e) {}
    }
  }

  function closeStory() {
    const modal = document.getElementById("storyModal");
    if (modal) modal.classList.remove("show");
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

    // Header Title (Fixed 300px centered box)
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

    // Render 6 Persistent Cards
    const track = document.getElementById("scCarouselTrack");
    if (track) {
      const cdh = diffProg()[state.diff];
      const cellOpen = cellUnlocked(ch, state.diff);
      track.innerHTML = ch.levels.map((_, i) => {
        const lv = ch.from + i;
        const en = enemyOf(lv);
        const cardData = en.id && CARDS[en.id] ? CARDS[en.id] : null;
        const tier = cardData ? cardData.tier : (en.boss ? "UR" : "R");
        const isCleared = !!cdh[lv];
        const isUnlocked = cellOpen && (i === 0 || !!cdh[lv - 1]);
        const g = gateOf(lv);

        return `
          <div class="sc-card tier-${tier} ${en.boss ? 'is-boss' : ''} ${isUnlocked ? '' : 'is-locked'}" id="sc-card-${i}" onclick="selectStoryStage(${i})">
            <div class="sc-card-head">
              <span class="sc-stage-badge">${en.boss ? '★ BOSS STAGE' : 'STAGE 0' + (i + 1)}</span>
              ${isCleared ? '<span class="sc-clear-status">✓ CLEARED</span>' : ''}
            </div>

            <div class="sc-art-frame">
              <img src="${en.img}" alt="${en.name}" loading="lazy" onerror="this.src='assets/cards/art/solar-brawler.webp'">
              <div class="sc-art-shade"></div>
              ${en.boss ? '<span class="sc-boss-tag">BOSS</span>' : ''}
              ${isUnlocked ? '' : `
                <div class="sc-card-lock-overlay">
                  <span class="sc-lock-icon">🔒</span>
                  <span class="sc-lock-text">${i === 0 ? 'BAB TERKUNCI' : 'SELESAIKAN STAGE 0' + i}</span>
                </div>
              `}
            </div>

            <div class="sc-card-info">
              <div class="sc-tier-row">
                <span class="sc-tier-pill sc-tier-${tier}">${tier}</span>
                <span class="sc-gate-val">${isUnlocked ? 'GATE ' + fmt(g) : 'TERKUNCI'}</span>
              </div>
              <div class="sc-card-name">${isUnlocked ? en.name : 'ENCRYPTED TARGET'}</div>
            </div>
          </div>
        `;
      }).join("");
    }

    // Render Dots
    const dotsEl = document.getElementById("scDotsIndicator");
    if (dotsEl) {
      const cdh = diffProg()[state.diff];
      const cellOpen = cellUnlocked(ch, state.diff);
      dotsEl.innerHTML = ch.levels.map((_, i) => {
        const lv = ch.from + i;
        const isUnlocked = cellOpen && (i === 0 || !!cdh[lv - 1]);
        return `<div class="sc-dot-node ${isUnlocked ? '' : 'locked'}" id="sc-dot-${i}" onclick="selectStoryStage(${i})" title="Stage 0${i+1}"></div>`;
      }).join("");
    }

    updateStoryCarouselPositions(true);
  }

  function updateStoryCarouselPositions(immediate = false) {
    const ch = activeChap();
    const cdh = diffProg()[state.diff];

    ch.levels.forEach((_, i) => {
      const cardEl = document.getElementById(`sc-card-${i}`);
      if (!cardEl) return;

      const offset = i - currentStageIdx;
      let posClass = "pos-hidden";
      if (offset === 0) posClass = "pos-0";
      else if (offset === 1) posClass = "pos-1";
      else if (offset === -1) posClass = "pos-neg-1";
      else if (offset === 2) posClass = "pos-2";
      else if (offset === -2) posClass = "pos-neg-2";

      cardEl.classList.remove("pos-0", "pos-1", "pos-neg-1", "pos-2", "pos-neg-2", "pos-hidden");
      cardEl.classList.add(posClass);
      cardEl.style.transform = "";
    });

    // Update Dots
    ch.levels.forEach((_, i) => {
      const dot = document.getElementById(`sc-dot-${i}`);
      if (dot) dot.classList.toggle("active", i === currentStageIdx);
    });

    // Update Bottom Dock with Crossfade
    const intelEl = document.getElementById("scDockIntel");
    const readEl = document.getElementById("scDockReadiness");

    if (intelEl && readEl) {
      intelEl.classList.add("dock-fade-out");
      readEl.classList.add("dock-fade-out");

      setTimeout(() => {
        const lv = ch.from + currentStageIdx;
        const en = enemyOf(lv);
        const cardData = en.id && CARDS[en.id] ? CARDS[en.id] : null;
        const tier = cardData ? cardData.tier : (en.boss ? "UR" : "R");
        const g = gateOf(lv);
        const pw = totalPower();
        const ok = pw >= g;
        const bar = Math.max(4, Math.min(100, Math.round(pw / g * 100)));

        const first = !cdh[lv];
        const reward = first ? firstClearReward(lv) : Math.round(firstClearReward(lv) * 0.2);
        const cellOpen = cellUnlocked(ch, state.diff);
        const isUnlocked = cellOpen && (currentStageIdx === 0 || !!cdh[lv - 1]);

        const stageLbl = document.getElementById("scDockStageNum");
        const enemyName = document.getElementById("scDockEnemyName");
        const gateVal = document.getElementById("scDockGateVal");
        const barFill = document.getElementById("scDockBarFill");
        const rewardVal = document.getElementById("scDockRewardVal");
        const battleBtn = document.getElementById("scBtnBattle");

        if (stageLbl) stageLbl.textContent = en.boss ? `STAGE 0${currentStageIdx + 1} // BOSS ENCOUNTER` : `STAGE 0${currentStageIdx + 1} // REGULAR STAGE`;
        if (enemyName) enemyName.textContent = isUnlocked ? `${en.name} [${tier}]` : `TERKUNCI — SELESAIKAN STAGE 0${currentStageIdx}`;
        if (gateVal) {
          if (!isUnlocked) {
            gateVal.innerHTML = `<span style="color:#ff4b5a">STAGE MASIH TERKUNCI</span>`;
          } else {
            gateVal.innerHTML = `${fmt(g)} (${ok ? '<span style="color:#00ffaa">SIAP TEMPUR</span>' : '<span style="color:#ff334b">POWER KURANG</span>'})`;
          }
        }
        if (barFill) {
          if (!isUnlocked) {
            barFill.style.width = "0%";
            barFill.style.background = "#334155";
          } else {
            barFill.style.width = bar + "%";
            barFill.style.background = ok ? 'linear-gradient(90deg, #1b6bff, #00ffaa)' : 'linear-gradient(90deg, #ff8c00, #ff334b)';
          }
        }
        if (rewardVal) rewardVal.textContent = isUnlocked ? `◎ ${fmt(reward)} Gold` : `—`;

        if (battleBtn) {
          if (!isUnlocked) {
            battleBtn.disabled = true;
            battleBtn.innerHTML = `<span>🔒</span> TERKUNCI`;
          } else {
            battleBtn.disabled = false;
            battleBtn.innerHTML = `<span>⚔</span> MULAI BATTLE`;
          }
        }

        intelEl.classList.remove("dock-fade-out");
        readEl.classList.remove("dock-fade-out");
      }, 120);
    }
  }

  function selectStoryStage(idx) {
    if (idx === currentStageIdx) return;
    if (window.sfx && sfx.hit) sfx.hit();
    currentStageIdx = idx;
    updateStoryCarouselPositions(false);
  }

  function slideStoryStage(dir) {
    const ch = activeChap();
    const next = currentStageIdx + dir;
    if (next < 0 || next >= ch.levels.length) return;
    if (window.sfx && sfx.hit) sfx.hit();
    currentStageIdx = next;
    updateStoryCarouselPositions(false);
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

    if (window.sfx && sfx.hit) sfx.hit();
    closeStory();
    state.battle = { level: lv };
    render();
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
