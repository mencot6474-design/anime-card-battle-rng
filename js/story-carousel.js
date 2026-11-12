/* ==========================================================================
   STORY-CAROUSEL.JS — "HAZARD PROTOCOL" STORY SCREEN
   Port 1:1 dari prototipe _tmp/proto_story_v1.html (desain dikunci user).
   Bahasa layar ini FULL ENGLISH (judul bab, lore, label, toast).
   Data & angka tetap dari sumber produksi: CHAPTERS/STORY_BIBLE, DIFFS,
   enemyOf/enemyStats/gateOf/totalPower, firstClearReward, storyGemPreview,
   storyCdLeft/storyCdText. Jangan salin angka reward ke file ini.

   Ekspor publik yang WAJIB tetap ada (dipakai state.js / boot.js):
     openStoryCarousel, openStory, closeStory, closeStoryCarousel,
     openMission, selectStoryStage, slideStoryStage, changeStoryChapter,
     initStoryCarousel, startAmbientLoop, stopAmbientLoop, battleStage
   ========================================================================== */

(function(){
  "use strict";

  var currentStageIdx = 0;
  var boundGestures = false;
  var canvasResizeObserver = null;
  var bannerBusy = false;
  var deploying = false;
  var bannerTimers = [];

  /* --------------------------------------------------------------------
     Copy tampilan per bab (English). Hanya judul/region/lore yang tampil;
     level, reward, musuh, gate tetap dari CHAPTERS + helper produksi.
     -------------------------------------------------------------------- */
  var CHAPTER_META = {
    1: {
      title: "NINJA VALLEY VILLAGE",
      short: "NINJA VALLEY",
      region: "VALLEY OF THE TWIN PEAKS",
      lore: [
        "In the valley between two mountains, a ninja village still guards a stone gate left by its ancestors. Six fighters hold the entrance, each carrying one inherited technique that was never taught beyond the walls.",
        "Word of the opened gate spreads fast: whoever topples every guardian earns the right to cross the village and claim the power core stored in its central tower.",
        "You step in from the outer gate. Every guardian you defeat records its technique into your card, so even a loss never sends you home empty-handed."
      ]
    },
    2: {
      title: "GREEN PLANET ORBIT",
      short: "GREEN PLANET",
      region: "FLOATING PLANET",
      lore: [
        "The stone gate was never just an exit. Once its six guards fell, the carvings ignited and opened a teleport path to a green planet drifting outside orbit, an arena where space-born fighters have tested their strength for ages.",
        "Six champions of the Green Planet guard nothing. They simply wait for a worthy opponent, and each one carries a technique sharpened for years under gravity far heavier than your home world.",
        "The record board at the planet gate lists a combat power peak of 686. Until that record is broken, the planet will keep holding your path shut."
      ]
    },
    3: {
      title: "SHIBUYA STATION CORRIDOR",
      short: "SHIBUYA",
      region: "UNDERGROUND STATION",
      lore: [
        "The teleport path reopens and drops you into an underground station that should have been sealed long ago: Shibuya Station. Emergency lights flicker, the platforms are empty, and curses crawl behind the concrete pillars.",
        "Six curses occupy the station, each bound to one forbidden technique. The destination board on the platform shows a combat power peak of 1,274, a number you must pass to walk out of here.",
        "Footsteps echo from inside the tunnel. Every curse you defeat records its technique into your card, so even a loss still carries part of them home with you."
      ]
    },
    4: {
      title: "MUSHIMA TOWN",
      short: "MUSHIMA",
      region: "CITY OF THE BLOOD RITUAL",
      lore: [
        "The last teleport drops you in a small town barely recorded on any map: Mushima Town. Time here moves like water in a slow river, calm until you feel the cold breath on your own neck.",
        "The town is full of people who are too perfect. They do not speak; they only wait for the dissection of three revived heirs completing a ritual their ancestors never finished.",
        "Every entity you defeat leaves a blood mark on your hand. It is not a curse, it is proof that you have earned the right to continue to the place where everything began."
      ]
    },
    5: {
      title: "INFINITE TSUDZUMI PALACE",
      short: "TSUDZUMI PALACE",
      region: "BOUNDLESS PALACE",
      lore: [
        "An old wooden door appears at the end of the street with no building attached. You enter and find a palace without limits: rooms overlapping each other with no architectural logic, spiral stairs connecting the same floor, windows showing a sky turning slowly.",
        "Seven demon hunters stand in different corners of the palace, each ruling one impossible chamber. They have waited thousands of years for the final trial: who is worthy to carry the Tsuzumi tradition to the end of the cycle.",
        "You cannot retreat. Every chamber you clear seals the door behind it. But every victory returns one lost memory from your past, and in the end, that is the greatest reward."
      ]
    }
  };

  /* --------------------------------------------------------------------
     English skill descriptions for the 30 story enemies. The card data
     (STORY_BIBLE/CARDS) keeps Indonesian desc for other screens; this
     screen is English-only, so it renders from this table first.
     -------------------------------------------------------------------- */
  var SKILL_DESC_EN = {
    CH_UNSTOPPABLE_FIST: "15% chance to strike twice in a row.",
    CH_COPY_NINJA: "Copies the opponent's last technique and mirrors it next turn.",
    CH_AWAKENED_DARK_AVENGER: "25% chance of a critical hit for 1.4x damage.",
    CH_AWAKENED_PROMISED_CHILD: "30% chance to pierce straight through enemy defense.",
    CH_SIX_PATHS_OF_PAIN: "25% chance to fully evade each incoming attack.",
    CH_BIJUU_BEAST: "30% chance to unleash 2-3 strikes and drain 15% of damage as HP.",
    CH_ULTIMATE_WARRIOR: "20% chance of a critical hit for 1.5x damage.",
    CH_BODY_SWITCHER: "20% chance to attack twice and drain 12% of damage as HP.",
    CH_NAMEKIAN_SAGE: "45% chance to pierce straight through enemy defense.",
    CH_AWAKENED_PRIDEFUL_PRINCE: "Deals 35% bonus damage while own HP stays above 60%.",
    CH_AWAKENED_EARTHS_STRONGEST: "25% chance to fire a 2-3 shot barrage.",
    CH_AWAKENED_GALACTIC_TYRANT: "20% chance to nullify incoming damage and drain 15% as HP.",
    CH_CURSED_DOLL: "18% chance to attack twice in a row.",
    CH_SHADOW_SUMMONER: "Raises a shadow guard that shrugs off attacks for the first two turns.",
    CH_CURSED_FIST: "30% chance of a cursed critical hit for 1.6x damage.",
    CH_RIKAS_BLESSING: "30% chance to unleash 2-3 strikes and drain 14% of damage as HP.",
    CH_LIMITLESS_MASTER: "40% chance to release a blast that ignores enemy defense.",
    CH_KING_OF_CURSES: "22% chance to nullify incoming damage and drain 18% as HP.",
    CH_PORCO_PILLAR: "30% chance of a crushing critical hit for 1.5x damage.",
    CH_AWAKENED_STAND_USER: "20% chance to land two strikes in a row.",
    "CH_GOLD_EXPERIENCE Requiem": "Drains 20% of all damage dealt back as HP.",
    "CH_THE WORLD": "25% chance to stop time, nullifying damage and healing instead.",
    CH_OPALESTONE_DREAM: "25% chance to slip away from each incoming attack.",
    CH_HEAVENS_DOOR: "40% chance to rewrite enemy defense and pierce it completely.",
    CH_TANJIRO_BLADE: "30% chance to unleash 2-3 sun-breath slashes.",
    CH_NEZUKO_BAMBOO: "Drains 18% of all damage dealt back as HP.",
    CH_INUIZO_MASK: "25% chance to lunge twice in a row.",
    CH_SANEMI_WIND: "35% chance to sweep 2-3 times with the wind blade.",
    CH_SHINOBU_BUTTERFLY: "45% chance to pierce defense, draining 15% of damage as HP."
  };

  /* English replacement for cellReqText() (that helper returns Indonesian). */
  function lockTextEn(ch, mode) {
    var idx = DIFFS.findIndex(function(d){ return d.k === mode; });
    var diff = DIFFS[idx] || { l: String(mode).toUpperCase() };
    if (idx <= 0) return "Complete the previous requirements to unlock this level.";
    if (ch.no === 1) {
      return "Clear every Chapter 1 stage on " + DIFFS[idx - 1].l + " to unlock " + diff.l + " mode.";
    }
    return "Clear every Chapter " + (ch.no - 1) + " stage on " + diff.l + " to unlock this chapter on " + diff.l + ".";
  }
  /* Koordinat node, persen dari kotak peta. */
  var COORDS_WIDE = [
    { xPct: 12, yPct: 74 },
    { xPct: 31, yPct: 48 },
    { xPct: 50, yPct: 70 },
    { xPct: 69, yPct: 44 },
    { xPct: 47, yPct: 22 },
    { xPct: 86, yPct: 18 }
  ];
  /* Peta pendek/sempit (HP portrait, landscape pendek) memakai rute
     serpentin 2 baris 3 node: node 48px tidak saling menimpa walaupun
     tinggi peta cuma ~130px. Peta lebar & tinggi memakai zig-zag. */
  var COORDS_SERPENTINE = [
    { xPct: 17, yPct: 72 },
    { xPct: 50, yPct: 72 },
    { xPct: 83, yPct: 72 },
    { xPct: 83, yPct: 26 },
    { xPct: 50, yPct: 26 },
    { xPct: 17, yPct: 26 }
  ];
  var PARTY_LABELS = ["LEAD", "MID", "SUP", "RES"];

  function $(id) { return document.getElementById(id); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function isPortrait() {
    var map = $("mapCanvas");
    if (map && map.offsetWidth > 0 && map.offsetHeight > 0) {
      return map.offsetHeight > map.offsetWidth || map.offsetWidth <= 620;
    }
    return window.matchMedia("(max-width: 819px)").matches;
  }

  function fmtNum(n) {
    return (Number.isFinite(+n) ? +n : 0).toLocaleString("en-US");
  }

  function metaOf(ch) {
    return CHAPTER_META[ch && ch.no] || {
      title: "SECTOR 0" + (ch ? ch.no : 1),
      short: "SECTOR 0" + (ch ? ch.no : 1),
      region: "UNKNOWN SECTOR",
      lore: ["Archive data for this sector is still encrypted in system memory."]
    };
  }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value;
  }

  function safeToast(main, sub, color) {
    try { if (typeof toast === "function") toast(main, sub, color); } catch (e) {}
  }
  function sfxHit() { if (window.sfx && sfx.hit) sfx.hit(); }
  function sfxLose() { if (window.sfx && sfx.lose) sfx.lose(); }

  /* ======================================================================
     BANNER HAZARD (masuk / keluar / deploy)
     ====================================================================== */
  function curtainEl() { return $("storyCurtain"); }

  function clearBannerTimers() {
    for (var i = 0; i < bannerTimers.length; i++) clearTimeout(bannerTimers[i]);
    bannerTimers = [];
  }

  function randomSerial() {
    return (0x1000 + Math.floor(Math.random() * 0xefff)).toString(16).toUpperCase();
  }

  function setBannerCopy(kind) {
    if (typeof state === "undefined" || !state) return;
    var ch = activeChap();
    var meta = metaOf(ch);
    var no = String(ch.no).padStart(2, "0");
    var kick = $("scHzKick");
    var title = $("scHzTitle");
    var water = $("scHzWater");
    var sub = $("scHzSub");
    var foot = $("scHzFoot");

    setText("scHzSerial", randomSerial());
    setText("scHzSector", no);

    if (kind === "out") {
      if (kick) kick.innerHTML = "// EXTRACTION <b>PROTOCOL</b>";
      if (title) title.textContent = "EXIT";
      if (water) water.textContent = "OUT";
      if (sub) sub.textContent = "CHAPTER " + no + " \u2014 " + meta.title;
      if (foot) foot.textContent = "RETURN TO LOBBY";
      return;
    }
    if (kick) kick.innerHTML = "// AUTHORIZED <b>INSERTION</b>";
    if (title) title.textContent = "SECTOR " + no;
    if (water) water.textContent = "STORY";
    if (sub) sub.textContent = "CHAPTER " + no + " \u2014 " + meta.title;
    if (foot) foot.textContent = "ENTER SECTOR";
  }

  function bannerEnter() {
    var c = curtainEl();
    if (!c) return;
    clearBannerTimers();
    setBannerCopy("in");
    bannerBusy = true;
    c.className = "";
    void c.offsetWidth;
    c.classList.add("on", "smooth", "sweep");
    bannerTimers.push(setTimeout(function(){ c.classList.add("revealed"); }, 1080));
    bannerTimers.push(setTimeout(function(){
      c.classList.remove("on", "smooth", "sweep", "revealed");
      bannerBusy = false;
    }, 1800));
  }

  function bannerExit(afterCovered) {
    var c = curtainEl();
    if (!c) { if (afterCovered) afterCovered(); return; }
    clearBannerTimers();
    setBannerCopy("out");
    bannerBusy = true;
    c.className = "";
    c.classList.add("on", "smooth", "revealed");
    void c.offsetWidth;
    c.classList.remove("revealed");
    bannerTimers.push(setTimeout(function(){ if (afterCovered) afterCovered(); }, 560));
    bannerTimers.push(setTimeout(function(){ c.classList.add("revealed"); }, 780));
    bannerTimers.push(setTimeout(function(){
      c.classList.remove("on", "smooth", "revealed");
      bannerBusy = false;
    }, 1560));
  }

  /* Banner deploy story DIHAPUS (permintaan user): battle sudah punya banner
     masuknya sendiri (#hzCurtain di battle-hazard.js), jadi dua banner
     bertumpuk saling nabrak. Story ditutup langsung, lalu battle merender
     banner-nya sendiri. */

  /* ======================================================================
     LIFECYCLE
     ====================================================================== */
  function hideStoryModal() {
    var modal = $("storyModal");
    if (!modal) return;
    modal.classList.remove("show");
    modal.classList.remove("active");
    modal.classList.remove("sheet-open");
  }

  function firstOpenStageIdx(ch) {
    var cdh = diffProg()[state.diff];
    var found = 0;
    for (var i = 0; i < ch.levels.length; i++) {
      var lv = ch.from + i;
      if (!cdh[lv]) { found = i; break; }
      found = i;
    }
    return found;
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

      var ch = activeChap();
      if (!cellUnlocked(ch, state.diff)) {
        state.diff = highestChapDiff(ch);
        save();
      }

      currentStageIdx = firstOpenStageIdx(ch);

      var mm = $("missionModal");
      if (mm) mm.classList.remove("show");
      closeDrawerOrSheet();
      closeLoreModal();

      var modal = $("storyModal");
      if (modal) modal.classList.add("show");

      buildStoryChapterDOM();

      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          renderTacticalNodes();
          updateStoryDrawer();
        });
      });

      bannerEnter();
    } catch (err) {
      console.error("openStory error:", err);
      safeToast("STORY ERROR", (err && err.message) || "failed to open story", "#ff5c5c");
    }
  }

  function closeStory() {
    var modal = $("storyModal");
    if (!modal || !modal.classList.contains("show")) return;
    closeDrawerOrSheet();
    closeLoreModal();
    if (deploying) { hideStoryModal(); return; }
    bannerExit(hideStoryModal);
  }

  /* ======================================================================
     RENDER
     ====================================================================== */
  function buildStoryChapterDOM() {
    initStoryCarousel();

    var ch = activeChap();
    var meta = metaOf(ch);
    var no = String(ch.no).padStart(2, "0");

    setText("chapBadgeNo", no);
    setText("chapTotal", "/" + String(CHAPTERS.length).padStart(2, "0"));
    /* Header sempit (portrait HP) atau landscape pendek: pakai nama pendek
       supaya tidak jadi "NINJA VALLEY VILLA...". */
    var narrowHeader = window.matchMedia("(max-width: 819px)").matches ||
                       window.matchMedia("(max-height: 520px)").matches;
    setText("chapTitleName", narrowHeader ? (meta.short || meta.title) : meta.title);

    var prevBtn = $("scPrevChap");
    var nextBtn = $("scNextChap");
    if (prevBtn) prevBtn.disabled = ch.no <= 1;
    if (nextBtn) nextBtn.disabled = ch.no >= CHAPTERS.length;

    var stageEl = $("stageCanvasArea");
    if (stageEl) stageEl.setAttribute("data-no", no);

    var eyebrow = $("stageEyebrow");
    if (eyebrow) {
      eyebrow.innerHTML =
        '<span class="eyebrow-badge">SECTOR ' + no + '</span>' +
        '<span class="eyebrow-sep"></span>' +
        '<span class="eyebrow-txt">RESONANCE ROUTE</span>';
    }

    var heroTitle = $("storyHeroTitle");
    if (heroTitle) {
      var words = meta.title.split(" ");
      var cut = words.length > 2 ? words.length - 2 : Math.max(1, words.length - 1);
      var head = words.slice(0, cut).join(" ");
      var tail = words.slice(cut).join(" ");
      heroTitle.innerHTML = head + (tail ? " <em>" + tail + "</em>" : "");
    }

    setText("heroRegion", meta.region);
    var stageChip = $("heroStages");
    if (stageChip) stageChip.innerHTML = "<b>" + ch.levels.length + "</b> STAGES";
    setText("heroDiff", diffOf().l);

    var loreEl = $("storyHeroLore");
    if (loreEl) loreEl.textContent = meta.lore[0];

    var scene = $("storySceneArt");
    if (scene) {
      try {
        var last = enemyOf(ch.to);
        if (last && last.img) scene.src = last.img;
      } catch (e) {}
    }

    renderChapterRail();
    renderDifficultyPills();
    renderProgress();
    renderTacticalNodes();
    updateStoryDrawer();
  }

  function renderChapterRail() {
    var host = $("chapterRailList");
    if (!host) return;
    var activeNo = activeChap().no;
    setText("railTotal", String(CHAPTERS.length).padStart(2, "0") + " SECTORS");

    host.innerHTML = CHAPTERS.map(function(c){
      var meta = metaOf(c);
      var prog = chapProgMode(c, state.diff);
      var pct = c.levels.length ? prog / c.levels.length : 0;
      var open = cellUnlocked(c, state.diff);
      return '<button class="rail-ch' + (c.no === activeNo ? " on" : "") + (open ? "" : " locked") + '"' +
        ' type="button" data-ch="' + c.no + '">' +
        '<span class="rail-no">' + String(c.no).padStart(2, "0") + '</span>' +
        '<span class="rail-nm">' + (meta.short || meta.title) + '</span>' +
        '<span class="rail-bar"><i style="transform:scaleX(' + pct + ')"></i></span>' +
        '</button>';
    }).join("");

    $$("#chapterRailList .rail-ch").forEach(function(b){
      b.onclick = function(){
        var no = +b.dataset.ch;
        if (no === activeChap().no) return;
        var target = CHAPTERS.find(function(c){ return c.no === no; });
        if (!target) return;
        if (!cellUnlocked(target, state.diff)) {
          sfxLose();
          safeToast("SECTOR LOCKED", lockTextEn(target, state.diff), "#ff5470");
          return;
        }
        sfxHit();
        state.chap = no;
        save();
        currentStageIdx = firstOpenStageIdx(target);
        closeDrawerOrSheet();
        buildStoryChapterDOM();
        requestAnimationFrame(renderTacticalNodes);
      };
    });
  }

  /* Label pendek untuk layar sempit: 5 pill harus muat tanpa terpotong. */
  var DIFF_SHORT = {
    normal: "NORM",
    hard: "HARD",
    extreme: "EXTREME",
    nightmare: "NIGHT",
    apocalypse: "APOC"
  };

  function renderDifficultyPills() {
    var ch = activeChap();
    var host = $("scDiffGroup");
    if (!host || typeof DIFFS === "undefined" || !DIFFS) return;

    /* Layar sempit ATAU landscape HP pendek (850x390): 5 pill penuh tidak
       muat, jadi pakai label pendek + title attribute berisi nama lengkap. */
    var narrow = window.matchMedia("(max-width: 460px)").matches ||
                 window.matchMedia("(max-height: 520px)").matches;

    host.innerHTML = DIFFS.map(function(d){
      var unl = cellUnlocked(ch, d.k);
      var on = d.k === state.diff;
      var txt = narrow ? (DIFF_SHORT[d.k] || d.l || d.k.toUpperCase()) : (d.l || d.k.toUpperCase());
      return '<button class="diff-btn' + (on ? " on" : "") + (unl ? "" : " locked") + '"' +
        ' type="button" data-d="' + d.k + '" title="' + (d.l || d.k.toUpperCase()) + '"' +
        (unl ? "" : ' aria-disabled="true"') + '>' + txt + '</button>';
    }).join("");

    $$("#scDiffGroup .diff-btn").forEach(function(b){
      b.onclick = function(){
        var k = b.dataset.d;
        if (!cellUnlocked(ch, k)) {
          sfxLose();
          safeToast("DIFFICULTY LOCKED", lockTextEn(ch, k), "#ff5470");
          return;
        }
        if (state.diff === k) return;
        state.diff = k;
        sfxHit();
        save();
        currentStageIdx = firstOpenStageIdx(ch);
        closeDrawerOrSheet();
        buildStoryChapterDOM();
      };
    });
  }

  function renderProgress() {
    var ch = activeChap();
    var cleared = chapProgMode(ch, state.diff);
    var total = ch.levels.length;
    var pct = total ? Math.round((cleared / total) * 100) : 0;

    setText("subProgText", cleared + " / " + total + " (" + pct + "%)");
    var fill = $("subProgFill");
    if (fill) {
      fill.style.transform = "scaleX(" + (total ? cleared / total : 0) + ")";
      fill.style.background = cleared >= total ? "#6be08a" : "#f3e600";
    }
  }

  function stageState(i, ch) {
    var cdh = diffProg()[state.diff];
    var cellOpen = cellUnlocked(ch, state.diff);
    var lv = ch.from + i;
    if (cdh[lv]) return "done";
    var unlocked = cellOpen && (i === 0 || !!cdh[lv - 1]);
    return unlocked ? "live" : "lock";
  }

  function renderTacticalNodes() {
    var ch = activeChap();
    var container = $("mapNodesContainer");
    var svg = $("mapSvg");
    var canvasEl = $("mapCanvas");
    if (!container || !svg || !canvasEl) return;

    var rect = canvasEl.getBoundingClientRect();
    var canvasW = canvasEl.offsetWidth || rect.width || 800;
    var canvasH = canvasEl.offsetHeight || rect.height || 380;
    var aspect = canvasH > 0 ? canvasW / canvasH : 2;
    var coords = (canvasH < 240 || aspect < 1.45) ? COORDS_SERPENTINE : COORDS_WIDE;
    svg.setAttribute("viewBox", "0 0 " + canvasW + " " + canvasH);
    svg.setAttribute("width", canvasW);
    svg.setAttribute("height", canvasH);

    var pts = coords.map(function(c){
      return { x: (c.xPct / 100) * canvasW, y: (c.yPct / 100) * canvasH };
    });

    var segs = "";
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var sa = stageState(i, ch), sb = stageState(i + 1, ch);
      var cls = "lock";
      if (sa === "done" && sb === "done") cls = "done";
      else if (sa === "done" || sa === "live") cls = "live";
      segs += '<line class="map-seg ' + cls + '" x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) +
        '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '"/>';
    }
    svg.innerHTML = segs;

    setText("mapCap", "NODE " + String(ch.levels.length).padStart(2, "0") + " // BOSS");

    container.innerHTML = ch.levels.map(function(_, idx){
      var lv = ch.from + idx;
      var en = enemyOf(lv);
      var st = stageState(idx, ch);
      var selected = idx === currentStageIdx;
      var boss = !!en.boss;
      var c = coords[idx];
      var glyph = st === "done" ? "&#10003;" : st === "lock" ? "&#9679;" : "&#9654;";
      /* Tanpa lazy: cuma 6 gambar, dan lazy membuat lingkaran kosong sesaat
         setiap peta di-render ulang (ganti bab / resize / sheet). */
      var face = '<img class="node-img" src="' + en.img + '" alt="' + en.name + '" decoding="async" ' +
        'onerror="this.onerror=null;this.src=\'assets/cards/art/solar-brawler.webp\'">';
      var inner = boss
        ? '<span class="node-dia">' + face + '</span>'
        : '<span class="node-ring"></span><span class="node-av">' + face + '</span>';
      var pulse = st === "live" ? '<span class="node-pulse"></span>' : "";

      return '<button class="map-node is-' + st + (boss ? " boss-node" : "") +
        (selected ? " active-node" : "") + '" type="button" data-i="' + idx + '"' +
        ' style="--x:' + c.xPct + '%;--y:' + c.yPct + '%"' +
        ' aria-label="Stage ' + (idx + 1) + " \u2014 " + en.name + '">' +
        inner + pulse +
        '<span class="node-no">' + String(idx + 1).padStart(2, "0") + '</span>' +
        '<span class="node-badge">' + glyph + '</span>' +
        '<span class="node-lbl"><b>' + (st === "lock" ? "ENCRYPTED" : en.name) + '</b>' +
        '<i>REQ ' + fmtNum(gateOf(lv)) + '</i></span>' +
        '</button>';
    }).join("");

    $$("#mapNodesContainer .map-node").forEach(function(b){
      b.onclick = function(){ selectStoryStage(+b.dataset.i); };
    });
  }

  function updateStoryDrawer() {
    var ch = activeChap();
    var lv = ch.from + currentStageIdx;
    var en = enemyOf(lv);
    var cdh = diffProg()[state.diff];
    var cellOpen = cellUnlocked(ch, state.diff);
    var unlocked = cellOpen && (currentStageIdx === 0 || !!cdh[lv - 1]);
    var cleared = !!cdh[lv];
    var first = !cleared;

    var no = String(ch.no).padStart(2, "0");
    var stageNo = String(currentStageIdx + 1).padStart(2, "0");
    var stageCode = "STAGE " + no + "-" + stageNo;

    setText("dwStageCode", stageCode + " // " + (en.boss ? "BOSS GATE" : "SECTOR COMBAT"));
    setText("dwStageCodeShort", "TARGET // STAGE " + stageNo);
    setText("dwEnemyNameShort", unlocked ? en.name : "ENCRYPTED");
    setText("dwEnemyName", unlocked ? en.name : "ENCRYPTED TARGET");
    setText("dwStatePill", !unlocked ? "ENCRYPTED" : cleared ? "CLEARED" : "IN ROUTE");
    setText("mqStageCode", stageCode);
    setText("mqEnemyName", unlocked ? en.name : "LOCKED");
    setText("mqDiff", diffOf().l);

    var pill = $("dwStatePill");
    if (pill) {
      pill.classList.toggle("cleared", cleared);
      pill.classList.toggle("locked", !unlocked);
    }

    var artEl = $("dwEnemyImg");
    if (artEl) {
      artEl.src = en.img;
      artEl.style.filter = unlocked ? "none" : "grayscale(1) brightness(0.35)";
    }
    var mqImg = $("mqEnemyImg");
    if (mqImg) {
      mqImg.src = (typeof thumbSrc === "function") ? thumbSrc(en.img) : en.img;
      mqImg.style.filter = unlocked ? "none" : "grayscale(1) brightness(0.45)";
    }

    var cardRef = null;
    if (typeof CARDS !== "undefined" && CARDS && en.id && CARDS[en.id]) cardRef = CARDS[en.id];
    else if (typeof MASTER_CARD_INDEX !== "undefined" && Array.isArray(MASTER_CARD_INDEX)) {
      cardRef = MASTER_CARD_INDEX.find(function(c){
        return c.char_id === en.id || c.name === en.name;
      }) || null;
    }

    var tierVal = cardRef ? (cardRef.tier || (en.boss ? "BOSS" : "R")) : (en.boss ? "BOSS" : "R");
    var typeVal = cardRef ? (cardRef.type || "OFFENSIVE") : "OFFENSIVE";
    setText("dwTierBadge", tierVal);
    setText("dwTypeBadge", String(typeVal).toUpperCase());

    var es = (typeof enemyStats === "function") ? enemyStats(lv) : { hp: 0, atk: 0 };
    var eHp = es.hp || 0;
    var eAtk = es.atk || 0;
    setText("dwEnemyHp", unlocked ? fmtNum(eHp) : "???");
    setText("dwEnemyAtk", unlocked ? fmtNum(eAtk) : "???");

    var skillName = cardRef
      ? ((cardRef.passive && cardRef.passive.name) || cardRef.skill || en.name)
      : (en.boss ? "ANCIENT BOSS WILL" : en.name);
    var skillDesc = (en.id && SKILL_DESC_EN[en.id])
      ? SKILL_DESC_EN[en.id]
      : (cardRef
          ? ((cardRef.passive && cardRef.passive.desc) || cardRef.desc || "Frontline guardian unit.")
          : (en.boss ? "Chapter main boss with extraordinary defense and attacks." : "Frontline defensive unit."));

    setText("dwAbilityTitle", unlocked ? String(skillName).toUpperCase() : "SIGNATURE: ENCRYPTED");
    setText("dwAbilityDesc", unlocked
      ? skillDesc
      : "Enemy skill intel is still locked. Defeat the previous stage to reveal the enemy tactics.");

    var reqPower = (typeof gateOf === "function") ? gateOf(lv) : (eHp + eAtk);
    var playerPower = (typeof totalPower === "function") ? totalPower() : 0;
    var ready = playerPower >= reqPower;
    var ratio = reqPower > 0 ? Math.min(1, playerPower / reqPower) : 1;
    var diffPct = reqPower > 0 ? Math.round(((playerPower - reqPower) / reqPower) * 100) : 100;

    var powerBox = $("scPowerBox");
    if (powerBox) powerBox.classList.toggle("risk", !ready);
    var bar = $("dwPowerBar");
    if (bar) bar.style.transform = "scaleX(" + ratio + ")";
    var badge = $("dwPowerDiffBadge");
    if (badge) {
      badge.textContent = ready ? "READY" : "POWER SHORT";
      badge.className = "readiness-status-badge " + (ready ? "ready" : "danger");
    }
    setText("scPowerTail", (diffPct >= 0 ? "+" : "") + diffPct + "%");
    setText("dwReqPower", fmtNum(reqPower));
    setText("dwPlayerPower", fmtNum(playerPower));
    setText("mqReq", fmtNum(reqPower));

    var coinReward = (typeof firstClearReward === "function") ? firstClearReward(lv) : 0;
    var gemReward = (typeof storyGemPreview === "function") ? storyGemPreview(lv) : 0;
    var cdLeft = first ? 0 : ((typeof storyCdLeft === "function") ? storyCdLeft(lv) : 0);

    setText("dwRewardCoin", "+" + fmtNum(coinReward) + " COINS");
    setText("dwRewardGem", "+" + fmtNum(gemReward) + " GEMS");
    var gemBox = $("dwGemBox");
    if (gemBox) gemBox.style.display = gemReward > 0 ? "inline-flex" : "none";
    setText("dwRwLbl", first ? "FIRST CLEAR REWARD" : "REPEAT REWARD");

    var cdBadge = $("dwCdBadge");
    if (cdBadge) {
      if (!first && cdLeft > 0) {
        cdBadge.style.display = "block";
        cdBadge.textContent = "REPLAY COOLDOWN \u00B7 " +
          ((typeof storyCdText === "function") ? storyCdText(cdLeft) : "");
      } else {
        cdBadge.style.display = "none";
      }
    }

    /* Resonance readout */
    var clearedCount = chapProgMode(ch, state.diff);
    var totalStages = ch.levels.length;
    var maxGem = 1;
    ch.levels.forEach(function(_, i){
      var g = (typeof storyGemPreview === "function") ? (storyGemPreview(ch.from + i) || 0) : 0;
      if (g > maxGem) maxGem = g;
    });
    var setBar = function(id, v){
      var el = $(id);
      if (el) el.style.transform = "scaleX(" + Math.max(0, Math.min(1, v)) + ")";
    };
    setBar("scRoSector", totalStages ? clearedCount / totalStages : 0);
    setText("scRoSectorV", clearedCount + "/" + totalStages);
    setBar("scRoThreat", playerPower > 0 ? Math.min(1, reqPower / Math.max(playerPower, 1)) : 0);
    setText("scRoThreatV", fmtNum(reqPower));
    setBar("scRoReward", (gemReward || 0) / Math.max(1, maxGem));
    setText("scRoRewardV", fmtNum(gemReward));

    /* Deploy CTA (dua elemen: footer drawer + dock) */
    var cdText = (!first && cdLeft > 0)
      ? ((typeof storyCdText === "function") ? storyCdText(cdLeft) : "COOLDOWN")
      : "";
    var blocked = !unlocked || (!first && cdLeft > 0);
    /* Satu label untuk semua state siap: PLAY (boss & stage biasa). */
    var label = !unlocked ? "LOCKED"
      : (!first && cdLeft > 0) ? cdText
      : "PLAY";
    var icon = !unlocked ? "i-lock" : (!first && cdLeft > 0) ? "i-bolt" : "i-swords";

    var deployBtn = $("btnDeploy");
    if (deployBtn) {
      deployBtn.dataset.cdRepeat = (!first && cdLeft > 0) ? "1" : "";
      deployBtn.disabled = blocked;
      deployBtn.classList.toggle("boss-deploy", !!en.boss);
      deployBtn.innerHTML = '<span class="ic ic-sm ' + icon + '"></span> ' + label;
    }

    var mqDeploy = $("btnMqDeploy");
    if (mqDeploy) {
      mqDeploy.dataset.cdRepeat = (!first && cdLeft > 0) ? "1" : "";
      mqDeploy.disabled = blocked;
      mqDeploy.classList.toggle("boss-deploy", !!en.boss);
      mqDeploy.innerHTML = '<span class="ic ic-sm ' + icon + '"></span> ' + label;
    }

    renderPartyDock();
  }

  function renderPartyDock() {
    var host = $("dockParty");
    if (!host) return;
    var deck = Array.isArray(state.deck) ? state.deck : [];
    var byId = {};
    (state.stacks || []).forEach(function(s){ if (s && s.id) byId[s.id] = s; });

    host.innerHTML = PARTY_LABELS.map(function(label, i){
      var stack = deck[i] ? byId[deck[i]] : null;
      if (!stack) return '<span class="dk-slot empty"><em>' + label + '</em></span>';
      var art = (typeof cardThumb === "function") ? cardThumb(stack.char) : "";
      var name = (typeof cardName === "function") ? cardName(stack.char) : "";
      return '<span class="dk-slot' + (i === 0 ? " lead" : "") + '" title="' + name + '">' +
        (art ? '<img src="' + art + '" alt="" width="48" height="48" decoding="async" onerror="this.remove()">' : "") +
        '<em>' + label + '</em></span>';
    }).join("");
  }

  /* ======================================================================
     INTERAKSI
     ====================================================================== */
  function selectStoryStage(idx) {
    var ch = activeChap();
    if (idx < 0 || idx >= ch.levels.length) return;

    if (stageState(idx, ch) === "lock") {
      sfxLose();
      safeToast("STAGE LOCKED", "Clear the previous stage first.", "#ff5470");
      return;
    }
    if (idx === currentStageIdx) {
      openBottomSheet();
      return;
    }
    sfxHit();
    currentStageIdx = idx;

    $$("#mapNodesContainer .map-node").forEach(function(n, i){
      n.classList.toggle("active-node", i === currentStageIdx);
    });

    updateStoryDrawer();
    if (isPortrait()) openBottomSheet();
  }

  function slideStoryStage(dir) {
    var ch = activeChap();
    var next = currentStageIdx + dir;
    if (next < 0 || next >= ch.levels.length) return;
    if (stageState(next, ch) === "lock") return;
    if (next === currentStageIdx) return;
    currentStageIdx = next;
    $$("#mapNodesContainer .map-node").forEach(function(n, i){
      n.classList.toggle("active-node", i === currentStageIdx);
    });
    updateStoryDrawer();
  }

  function openBottomSheet() {
    var modal = $("storyModal");
    if (modal) modal.classList.add("sheet-open");
  }

  function closeDrawerOrSheet() {
    var modal = $("storyModal");
    if (modal) modal.classList.remove("sheet-open");
  }

  function openLoreModal() {
    sfxHit();
    var ch = activeChap();
    var meta = metaOf(ch);
    var overlay = $("loreModal");
    var title = $("loreModalTitle");
    var content = $("loreModalBody");

    if (title) {
      title.innerHTML = '<span class="ic ic-md i-scroll"></span> CHAPTER ' +
        String(ch.no).padStart(2, "0") + " \u2014 " + meta.title;
    }
    if (content) {
      content.innerHTML = meta.lore.map(function(p){
        return '<p class="lore-paragraph">' + p + '</p>';
      }).join("");
      content.scrollTop = 0;
    }
    if (overlay) overlay.classList.add("open");
  }

  function closeLoreModal() {
    var overlay = $("loreModal");
    if (overlay) overlay.classList.remove("open");
  }

  function launchSelectedBattle() {
    var ch = activeChap();
    var lv = ch.from + currentStageIdx;
    var cdh = diffProg()[state.diff];
    var cellOpen = cellUnlocked(ch, state.diff);
    var unlocked = cellOpen && (currentStageIdx === 0 || !!cdh[lv - 1]);

    if (!unlocked) {
      sfxLose();
      safeToast("STAGE LOCKED", "Clear the previous stage first.", "#ff5470");
      return;
    }

    var first = !cdh[lv];
    var cdLeft = first ? 0 : ((typeof storyCdLeft === "function") ? storyCdLeft(lv) : 0);
    if (!first && cdLeft > 0) {
      sfxLose();
      safeToast("COOLDOWN", "Replay of this stage is still on cooldown.", "#fbbf24");
      return;
    }

    sfxHit();
    /* Tanpa banner deploy story: banner masuk milik battle yang tampil. */
    hideStoryModal();
    if (typeof startStoryBattle === "function") startStoryBattle(lv);
  }

  /* ======================================================================
     BINDING
     ====================================================================== */
  function initStoryCarousel() {
    var btnBack = $("scBtnBack");
    var closeBtn = $("smClose");
    var prevBtn = $("scPrevChap");
    var nextBtn = $("scNextChap");
    var chapInfo = $("chapTitleName");
    var btnDeploy = $("btnDeploy");
    var btnMqDeploy = $("btnMqDeploy");
    var drawerHandle = $("scDrawerClose");
    var mqExpandBtn = $("btnMqExpand");
    var mobileDock = $("mobileQuickDock");
    var loreSubBtn = $("btnLoreSub");
    var loreCloseBtn = $("btnLoreClose");

    if (btnBack) btnBack.onclick = function(){ sfxHit(); closeStory(); };
    if (closeBtn) closeBtn.onclick = function(){ sfxHit(); closeStory(); };
    if (prevBtn) prevBtn.onclick = function(){ sfxHit(); changeStoryChapter(-1); };
    if (nextBtn) nextBtn.onclick = function(){ sfxHit(); changeStoryChapter(1); };
    if (chapInfo) chapInfo.onclick = function(){ openLoreModal(); };

    if (btnDeploy) btnDeploy.onclick = function(e){ e.stopPropagation(); launchSelectedBattle(); };
    if (btnMqDeploy) btnMqDeploy.onclick = function(e){ e.stopPropagation(); launchSelectedBattle(); };

    if (drawerHandle) {
      drawerHandle.onclick = function(e){
        e.stopPropagation();
        sfxHit();
        var modal = $("storyModal");
        if (modal && modal.classList.contains("sheet-open")) closeDrawerOrSheet();
        else openBottomSheet();
      };
    }

    if (mobileDock) {
      mobileDock.onclick = function(e){
        if (e.target.closest("#btnMqDeploy") || e.target.closest("#btnDeploy")) return;
        openBottomSheet();
      };
    }
    if (mqExpandBtn) {
      mqExpandBtn.onclick = function(e){
        e.stopPropagation();
        sfxHit();
        var modal = $("storyModal");
        if (modal && modal.classList.contains("sheet-open")) closeDrawerOrSheet();
        else openBottomSheet();
      };
    }

    if (loreSubBtn) loreSubBtn.onclick = function(){ openLoreModal(); };
    if (loreCloseBtn) loreCloseBtn.onclick = function(){ closeLoreModal(); };

    var loreOverlay = $("loreModal");
    if (loreOverlay) {
      loreOverlay.onclick = function(e){
        if (e.target === loreOverlay) closeLoreModal();
      };
    }

    /* Mobile: ketuk area peta (scrim) untuk menutup bottom sheet.
       Klik node sendiri sudah membuka sheet, jadi node dikecualikan —
       kalau tidak, event bubble-nya menutup sheet lagi seketika. */
    var stageEl = $("stageCanvasArea");
    if (stageEl) {
      stageEl.addEventListener("click", function(e){
        var modal = $("storyModal");
        if (!modal || !modal.classList.contains("sheet-open")) return;
        if (e.target.closest(".map-node")) return;
        closeDrawerOrSheet();
      });
    }

    if (!boundGestures) {
      boundGestures = true;

      window.addEventListener("keydown", function(e){
        var modal = $("storyModal");
        if (!modal || !modal.classList.contains("show")) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); slideStoryStage(-1); }
        if (e.key === "ArrowRight") { e.preventDefault(); slideStoryStage(1); }
        if (e.key === "Escape") {
          var lore = $("loreModal");
          if (lore && lore.classList.contains("open")) closeLoreModal();
          else if (modal.classList.contains("sheet-open")) closeDrawerOrSheet();
          else closeStory();
        }
      });

      var rzT = 0;
      var handleResize = function(){
        clearTimeout(rzT);
        rzT = setTimeout(function(){
          var modal = $("storyModal");
          if (modal && (modal.classList.contains("show") || modal.classList.contains("active"))) {
            renderTacticalNodes();
          }
        }, 130);
      };
      window.addEventListener("resize", handleResize);
      try {
        window.matchMedia("(orientation: portrait)").addEventListener("change", handleResize);
      } catch (e) {}
    }

    var canvasEl = $("mapCanvas");
    if (canvasEl && window.ResizeObserver && !canvasResizeObserver) {
      canvasResizeObserver = new ResizeObserver(function(){
        var modal = $("storyModal");
        if (modal && (modal.classList.contains("show") || modal.classList.contains("active"))) {
          renderTacticalNodes();
        }
      });
      canvasResizeObserver.observe(canvasEl);
    }
  }

  function changeStoryChapter(dir) {
    if (typeof CHAPTERS === "undefined" || !CHAPTERS) return;
    var currentChapNo = state ? state.chap : 1;
    var nextChapNo = currentChapNo + dir;
    if (nextChapNo < 1) nextChapNo = 1;
    if (nextChapNo > CHAPTERS.length) nextChapNo = CHAPTERS.length;
    if (nextChapNo === currentChapNo) return;

    var nextChap = CHAPTERS.find(function(c){ return c.no === nextChapNo; });
    if (!nextChap) return;

    if (!cellUnlocked(nextChap, state.diff)) {
      sfxLose();
      safeToast("SECTOR LOCKED", lockTextEn(nextChap, state.diff), "#ff5470");
      return;
    }

    state.chap = nextChapNo;
    save();
    currentStageIdx = firstOpenStageIdx(nextChap);
    closeDrawerOrSheet();
    buildStoryChapterDOM();
    requestAnimationFrame(renderTacticalNodes);
  }

  /* ---------------------------------------------------------------------
     Tick kooldown replay 1 detik. state.js:updateStoryCdUI() lama masih
     menargetkan DOM carousel (.sc-card / scBtnBattle / scDockCd) yang sudah
     tidak ada, jadi label tombol deploy di layar ini diurus di sini.
     Hanya menyentuh teks/atribut — tidak me-render ulang DOM (§7 anti-flicker).
     --------------------------------------------------------------------- */
  var cdTicker = 0;
  function startCdTicker() {
    if (cdTicker) return;
    cdTicker = setInterval(function(){
      var modal = $("storyModal");
      if (!modal || !modal.classList.contains("show")) return;
      if (typeof state === "undefined" || !state) return;

      var btn = $("btnDeploy");
      var mq = $("btnMqDeploy");
      var active = (btn && btn.dataset.cdRepeat === "1") || (mq && mq.dataset.cdRepeat === "1");
      if (!active) return;

      var ch = activeChap();
      var lv = ch.from + currentStageIdx;
      var left = (typeof storyCdLeft === "function") ? storyCdLeft(lv) : 0;
      if (left > 0) {
        var txt = (typeof storyCdText === "function") ? storyCdText(left) : "";
        if (btn) btn.innerHTML = '<span class="ic ic-sm i-bolt"></span> ' + txt;
        if (mq) mq.innerHTML = '<span class="ic ic-sm i-bolt"></span> ' + txt;
        var cd = $("dwCdBadge");
        if (cd) cd.textContent = "REPLAY COOLDOWN \u00B7 " + txt;
        return;
      }
      /* Kooldown habis: tombol kembali jadi REPLAY STAGE tanpa render ulang. */
      updateStoryDrawer();
    }, 1000);
  }

  /* Latar hazard murni CSS (§2b): tidak ada canvas/RAF dekoratif.
     Nama fungsi dipertahankan karena diekspor ke window. */
  function startAmbientLoop() { startCdTicker(); }
  function stopAmbientLoop() {
    if (cdTicker) { clearInterval(cdTicker); cdTicker = 0; }
  }

  /* ======================================================================
     EKSPOR PUBLIK (jangan diubah)
     ====================================================================== */
  window.openStoryCarousel = openStory;
  window.openStory = openStory;
  window.closeStory = closeStory;
  window.closeStoryCarousel = closeStory;
  window.openMission = function(){ openStory(); };
  window.selectStoryStage = selectStoryStage;
  window.slideStoryStage = slideStoryStage;
  window.changeStoryChapter = changeStoryChapter;
  window.initStoryCarousel = initStoryCarousel;
  window.startAmbientLoop = startAmbientLoop;
  window.stopAmbientLoop = stopAmbientLoop;
  window.battleStage = function(lv) {
    if (typeof startStoryBattle === "function") startStoryBattle(lv);
  };
})();






















