/* ==========================================================================
   BATTLE HAZARD v2.2 — Production Arena Layer (port _tmp/proto_battle_hazard_v1.html)
   Theme: WHITE-on-BLACK (#050505 / #0b0b0b / #f5f5f5) + hazard accent #f3e600
   Features:
   1. 3D Perspective Tactical Battle Mat (#hzArena -> .table-stage > .table-mat)
   2. Top HUD (#hzHud):
      - Left skewed parallelogram wing (.hud-wing.me): avatar, operator name, big HP, 4 alive pips, TURN N
      - Center trapezoid banner (.hud-center): mode kicker, stage/floor/boss title, live MM:SS timer, INFO button
      - Right skewed parallelogram wing (.hud-wing.foe): enemy avatar, name, big HP, 4 alive pips,
        skewed ENEMY LINE-UP tray (#hzFoeLineup), and passive callout (#hzFoeCallout)
   3. Live DECK & GRAVE Piles + SUPPORT Slot on the Mat (#hzMatPiles):
      - Player DECK shows the next waiting party card's artwork (bt.fighters[bt.active + 1]) with NEXT tag & count
      - Player GRAVE shows the most recently fallen party card's grayscale artwork with KO tag & count
      - Player SUPPORT shows equipped Pet / Artifact 1 / next party support
      - Enemy DECK shows next wave's artwork (towerRun.waves[towerRun.idx + 1]) & count
      - Enemy GRAVE shows last defeated wave's grayscale artwork & count
   4. Flying Card Swap Ghost Layer (#hzSwapLayer):
      - window.hzAnimateDeathAndSwap(side, fallenInfo, nextInfo):
        1) Fallen card shrinks/flies in an arc into GRAVE pile + pulses GRAVE pile
        2) Next card in DECK queue spawns at DECK pile and flies/expands into active card slot!
   5. Bottom-Left Skewed YOUR PARTY Tray (#hzPartyRail) with KO overlay and live HP bars
   6. Bottom-Right Skewed Control Rail (#hzActRail):
      - Background: On/Off (B)
      - ↻ Restart: OFF/ON (T) — visible ONLY in Infinite Tower
      - « 1x Speed (X)
      - × End Battle (E)
   ========================================================================== */
(function () {
  'use strict';

  var timers = [];
  var syncT = 0;
  var clockT = 0;
  var battleStartMs = 0;
  var bgOn = true;
  var toastTimer = 0;

  function $(id) { return document.getElementById(id); }
  function mk(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function drop(id) {
    var n = $(id);
    if (n && n.parentNode) n.parentNode.removeChild(n);
  }
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers = [];
  }
  function pad2(n) { n = Math.max(0, n | 0); return (n < 10 ? '0' : '') + n; }
  function fmtNum(n) {
    n = Math.max(0, Math.round(n || 0));
    if (typeof fmtBattleK === 'function') return fmtBattleK(n);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function spdMs(ms) {
    if (typeof bsMs === 'function') return Math.max(120, bsMs(ms));
    return ms;
  }

  /* --------------------------------------------------- BATTLE CONTEXT */
  function isTowerMode() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (b && b.tower) return true;
    var tRun = (typeof towerRun !== 'undefined') ? towerRun : null;
    var tView = (typeof towerView !== 'undefined') ? towerView : '';
    return !!(tRun && tRun.waves && tView === 'battle');
  }
  function isRaidMode() {
    var r = (typeof raid !== 'undefined') ? raid : null;
    if (r && !r.over && r.boss) return true;
    return document.body.classList.contains('battle-raid');
  }

  function battleInfo() {
    var info = { mode: 'story', kick: 'STORY PROTOCOL &middot; <b>SECTOR 01</b>', title: 'STAGE 1', phase: 'PLAYER INITIATIVE' };
    var b = (typeof bt !== 'undefined') ? bt : null;
    var tRun = (typeof towerRun !== 'undefined') ? towerRun : null;
    var r = (typeof raid !== 'undefined') ? raid : null;

    if (isTowerMode() && tRun) {
      info.mode = 'tower';
      info.kick = 'CORE SPIRE &middot; <b>INFINITE TOWER</b>';
      info.title = 'FLOOR ' + (tRun.floor || 1);
      info.phase = (typeof towerIsBossFloor === 'function' && towerIsBossFloor(tRun.floor))
        ? 'BOSS ENCOUNTER'
        : 'WAVE ' + ((tRun.idx || 0) + 1) + '/' + ((tRun.waves || []).length || 1);
      return info;
    }
    if (isRaidMode()) {
      var boss = (r && r.boss) || (typeof wbBossOf === 'function' ? wbBossOf() : null);
      info.mode = 'raid';
      info.kick = 'WORLD BOSS &middot; <b>RAID PROTOCOL</b>';
      info.title = (boss && boss.name) || 'WORLD BOSS';
      info.phase = 'RAID ENGAGEMENT';
      return info;
    }
    var lv = (b && b.lv != null) ? b.lv : ((typeof state !== 'undefined' && state && state.battle) ? state.battle.level : 1);
    var chNo = 1;
    try { if (typeof chapOf === 'function' && lv) chNo = (chapOf(lv) || {}).no || 1; } catch (e) {}
    info.mode = 'story';
    info.kick = 'STORY PROTOCOL &middot; <b>CHAPTER ' + pad2(chNo) + '</b>';
    info.title = 'STAGE ' + pad2(lv || 1);
    info.phase = 'PLAYER INITIATIVE';
    return info;
  }

  function cardArtOf(charId, fallback) {
    try { if (charId && typeof cardImg === 'function') return cardImg(charId); } catch (e) {}
    return fallback || 'assets/cards/art/shadow-monarch.webp';
  }
  function cardThumbOf(charId, fallback) {
    try { if (charId && typeof cardThumb === 'function') return cardThumb(charId); } catch (e) {}
    return cardArtOf(charId, fallback);
  }
  function cardNameOf(charId, fallback) {
    try { if (charId && typeof cardName === 'function') return cardName(charId); } catch (e) {}
    return fallback || 'OPERATOR';
  }

  function activeMeInfo() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    var r = (typeof raid !== 'undefined') ? raid : null;
    if (b) {
      if (b.shadow) {
        return {
          name: b.shadow.name || 'SHADOW',
          art: b.shadow.img || '',
          hp: Math.max(0, b.pHp || 0),
          max: Math.max(1, b.pMax || 1),
          turn: b.turn || 1
        };
      }
      var f = (b.fighters && b.fighters[b.active || 0]) || b.eq || null;
      var ch = f ? f.char : null;
      return {
        name: cardNameOf(ch, 'OPERATOR'),
        art: cardArtOf(ch),
        hp: Math.max(0, b.pHp != null ? b.pHp : 1),
        max: Math.max(1, b.pMax || 1),
        turn: b.turn || 1
      };
    }
    if (r && r.boss) {
      var eqR = (typeof raidPicked !== 'undefined' && raidPicked) ? raidPicked : (typeof equipped === 'function' ? equipped() : null);
      var chR = (eqR && eqR.char) || r.cid || null;
      var stR = chR && typeof cardStats === 'function' ? cardStats(chR, eqR && eqR.mut, eqR && eqR.trait, eqR && eqR.shiny) : { hp: 1000 };
      return {
        name: cardNameOf(chR, 'STRIKER'),
        art: cardArtOf(chR),
        hp: stR.hp || 1000,
        max: stR.hp || 1000,
        turn: r.turn || 1
      };
    }
    var eq0 = (typeof equipped === 'function') ? equipped() : null;
    var ch0 = eq0 ? eq0.char : null;
    var st0 = (ch0 && typeof cardStats === 'function') ? cardStats(ch0, eq0.mut, eq0.trait, eq0.shiny) : { hp: 1000 };
    return {
      name: cardNameOf(ch0, 'OPERATOR'),
      art: cardArtOf(ch0),
      hp: st0.hp || 1000,
      max: st0.hp || 1000,
      turn: 1
    };
  }

  function activeFoeInfo() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    var tRun = (typeof towerRun !== 'undefined') ? towerRun : null;
    var r = (typeof raid !== 'undefined') ? raid : null;

    if (b && b.en) {
      var mx = (b.es && b.es.hp) || (b.en && b.en.hp) || 1;
      var cur = b.eHp != null ? Math.max(0, b.eHp) : mx;
      var cid = b.eid || (b.en && (b.en.id || b.en.char)) || null;
      var cd = (cid && typeof CARDS !== 'undefined') ? CARDS[cid] : null;
      var pName = (cd && cd.passive && cd.passive.name) || (b.en && b.en.skill) || (b.en && b.en.epithet) || 'TACTICAL OVERDRIVE';
      var pSub = (b.en && b.en.boss) ? 'BOSS PROTOCOL ACTIVE' : ('ATK ' + fmtNum((b.es && b.es.atk) || 0));
      return {
        name: b.en.name || 'TARGET',
        art: b.en.img || cardArtOf(cid),
        hp: cur,
        max: mx,
        coTitle: String(pName).toUpperCase() + '!',
        coSub: pSub
      };
    }
    if (isTowerMode() && tRun && tRun.waves && tRun.waves[tRun.idx || 0]) {
      var w = tRun.waves[tRun.idx || 0];
      var mxW = (w.es && w.es.hp) || 1;
      var curW = w.hp != null ? Math.max(0, w.hp) : mxW;
      var cdW = (w.eid && typeof CARDS !== 'undefined') ? CARDS[w.eid] : null;
      var pNameW = (cdW && cdW.passive && cdW.passive.name) || (w.en && w.en.epithet) || 'FLOOR GUARD';
      return {
        name: (w.en && w.en.name) || 'FLOOR GUARD',
        art: (w.en && w.en.img) || cardArtOf(w.eid),
        hp: curW,
        max: mxW,
        coTitle: String(pNameW).toUpperCase() + '!',
        coSub: 'ATK ' + fmtNum((w.es && w.es.atk) || 0)
      };
    }
    if (isRaidMode()) {
      var boss = (r && r.boss) || (typeof wbBossOf === 'function' ? wbBossOf() : null);
      var mxR = (r && r.max) || (boss && boss.hp) || 1;
      var curR = (r && r.hp != null) ? Math.max(0, r.hp) : mxR;
      return {
        name: (boss && boss.name) || 'WORLD BOSS',
        art: (boss && boss.img) || 'assets/cards/art/eternal-dragon.webp',
        hp: curR,
        max: mxR,
        coTitle: 'CALAMITY SOVEREIGN!',
        coSub: (boss && boss.tier ? boss.tier + ' · ' : '') + 'RAID BOSS'
      };
    }
    try {
      var lv = (typeof state !== 'undefined' && state && state.battle) ? state.battle.level : 1;
      if (typeof enemyOf === 'function' && typeof enemyStats === 'function') {
        var en = enemyOf(lv), es = enemyStats(lv);
        var cdS = (en && en.id && typeof CARDS !== 'undefined') ? CARDS[en.id] : null;
        return {
          name: (en && en.name) || 'TARGET',
          art: (en && en.img) || '',
          hp: (es && es.hp) || 100,
          max: (es && es.hp) || 100,
          coTitle: (((cdS && cdS.passive && cdS.passive.name) || (en && en.skill) || 'SECTOR GUARD') + '!').toUpperCase(),
          coSub: 'ATK ' + fmtNum((es && es.atk) || 0)
        };
      }
    } catch (e) {}
    return { name: 'TARGET', art: 'assets/cards/art/nine-tail-prodigy.webp', hp: 100, max: 100, coTitle: 'TARGET ENGAGED!', coSub: '+10% DMG' };
  }

  /* -------------------------------------------- 1. ARENA + 3D BATTLE MAT */
  function buildArena() {
    if ($('hzArena')) return;
    var a = mk('div', 'hz-arena arena');
    a.id = 'hzArena';
    if (!bgOn) a.classList.add('bg-off');
    a.innerHTML =
      '<div class="bg"></div>' +
      '<div class="vig"></div>' +
      '<div class="table-stage">' +
        '<div class="table-mat">' +
          '<div class="table-post tl"></div>' +
          '<div class="table-post tr"></div>' +
          '<div class="table-corner-sigil tl"></div>' +
          '<div class="table-corner-sigil tr"></div>' +
          '<div class="table-corner-sigil bl"></div>' +
          '<div class="table-corner-sigil br"></div>' +
          '<div class="table-horizon"></div>' +
          '<div class="table-sigil"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(a);
  }

  /* -------------------------------------------- 2. TOP HUD (WINGS + CENTER) */
  function buildHud() {
    drop('hzHud');
    var info = battleInfo();
    var me = activeMeInfo();
    var foe = activeFoeInfo();

    var hud = mk('div', 'hz-hud hud');
    hud.id = 'hzHud';
    hud.innerHTML =
      /* PLAYER LEFT PARALLELOGRAM WING */
      '<div class="hud-wing me">' +
        '<div class="hud-banner">' +
          '<div class="hud-unskew">' +
            '<div class="hud-ava"><img id="hudMeAva" src="' + esc(me.art) + '" alt=""></div>' +
            '<div class="hud-meta">' +
              '<div class="hud-uname" id="hudMeName">' + esc(me.name) + '</div>' +
              '<div class="hud-hp-big"><span>HP</span><b id="hudMeHpNum">' + fmtNum(me.hp) + '</b></div>' +
              '<div class="hud-pips-row" id="hudMePips">' +
                '<span class="hud-pip on"></span>' +
                '<span class="hud-pip on"></span>' +
                '<span class="hud-pip on"></span>' +
                '<span class="hud-pip on"></span>' +
                '<span class="hud-turn-tag" id="hudTurn">TURN ' + (me.turn || 1) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* CENTER TRAPEZOID BANNER */
      '<div class="hud-center">' +
        '<div class="hc-kick" id="hcKick">' + info.kick + '</div>' +
        '<div class="hc-title" id="hcTitle">' + esc(info.title) + '</div>' +
        '<div class="hc-timer" id="hcTimer">00:00</div>' +
        '<button class="hc-info-btn" id="hzStageInfoBtn" type="button" title="Stage Info">' +
          '<i>i</i><span>INFO</span>' +
        '</button>' +
      '</div>' +

      /* ENEMY RIGHT PARALLELOGRAM WING + LINE-UP TRAY + CALLOUT */
      '<div class="hud-wing foe">' +
        '<div class="hud-banner">' +
          '<div class="hud-unskew">' +
            '<div class="hud-ava"><img id="hudFoeAva" src="' + esc(foe.art) + '" alt=""></div>' +
            '<div class="hud-meta">' +
              '<div class="hud-uname" id="hudFoeName">' + esc(foe.name) + '</div>' +
              '<div class="hud-hp-big"><b id="hudFoeHpNum">' + fmtNum(foe.hp) + '</b><span>HP</span></div>' +
              '<div class="hud-pips-row" id="hudFoePips">' +
                '<span class="hud-pip on"></span>' +
                '<span class="hud-pip on"></span>' +
                '<span class="hud-pip on"></span>' +
                '<span class="hud-pip on"></span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="foe-lineup-wrap" id="hzFoeLineup">' +
          '<div class="foe-lineup-tray" id="hzFoeLineupTray"></div>' +
          '<div class="foe-lineup-lbl">ENEMY LINE-UP</div>' +
        '</div>' +
        '<div class="foe-callout" id="hzFoeCallout">' +
          '<div class="co-title" id="coTitle">' + esc(foe.coTitle) + '</div>' +
          '<div class="co-sub" id="coSub">' + esc(foe.coSub) + '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(hud);

    var infoBtn = $('hzStageInfoBtn');
    if (infoBtn) {
      infoBtn.onclick = function () {
        if (isTowerMode() && typeof openTowerDropModal === 'function') {
          openTowerDropModal();
          return;
        }
        var fNow = activeFoeInfo();
        showHzToast('SECTOR INTEL // ' + fNow.name + ' · ' + fNow.coTitle);
      };
    }

    syncHud();
  }

  /* -------------------------------------------- 3. DECK & GRAVE PILES + SUPPORT */
  function supportInfo() {
    try {
      if (typeof state !== 'undefined' && state) {
        if (state.petEquipped && typeof PET_DEFS !== 'undefined' && Array.isArray(PET_DEFS)) {
          for (var i = 0; i < PET_DEFS.length; i++) {
            var p = PET_DEFS[i];
            if (p && p.id === state.petEquipped) {
              var pName = (window.GameLang && window.GameLang.petNameEn && window.GameLang.petNameEn(p.id)) || p.name || 'COMPANION';
              return { name: pName, img: p.img || p.icon || 'assets/pets/kyubi.webp' };
            }
          }
        }
        var arts = Array.isArray(state.artSlots) ? state.artSlots : [];
        var aId = arts[0] || arts[1] || null;
        if (aId && typeof ART_DEFS !== 'undefined' && Array.isArray(ART_DEFS)) {
          for (var j = 0; j < ART_DEFS.length; j++) {
            var a = ART_DEFS[j];
            if (a && a.id === aId) {
              var aName = (window.GameLang && window.GameLang.artNameEn && window.GameLang.artNameEn(a.id)) || a.name || 'RELIC';
              return { name: aName, img: a.img || a.icon || 'assets/artifacts/pedang-api.webp' };
            }
          }
        }
      }
    } catch (e) {}
    return { name: 'LIMIT BREAKER', img: 'assets/cards/art/shadow-heir.webp' };
  }

  function buildPiles() {
    drop('hzPileStrip');
    drop('hzMatPiles');
    var sup = supportInfo();
    var wrap = mk('div', 'hz-mat-piles');
    wrap.id = 'hzMatPiles';
    wrap.innerHTML =
      /* PLAYER MAT CLUSTER: DECK + GRAVE + SUPPORT */
      '<div class="mat-cluster me">' +
        '<div class="pile-card is-empty" id="meDeckPile" title="Next Party Card in Deck">' +
          '<div class="pile-art-wrap"><img id="meDeckImg" src="assets/cards/art/shadow-monarch.webp" alt=""></div>' +
          '<span class="pile-next-tag">NEXT</span>' +
          '<span class="pile-empty-ico">&mdash;</span>' +
          '<span class="pile-badge" id="meDeckCnt">0</span>' +
          '<span class="pile-lbl">DECK</span>' +
        '</div>' +
        '<div class="pile-card grave is-empty" id="meGravePile" title="Fallen Party Cards">' +
          '<div class="pile-art-wrap"><img id="meGraveImg" src="assets/cards/art/shadow-monarch.webp" alt=""></div>' +
          '<span class="pile-next-tag">KO</span>' +
          '<span class="pile-empty-ico">&times;</span>' +
          '<span class="pile-badge" id="meGraveCnt">0</span>' +
          '<span class="pile-lbl">GRAVE</span>' +
        '</div>' +
      '</div>' +

      /* ENEMY MAT CLUSTER: DECK + GRAVE */
      '<div class="mat-cluster foe">' +
        '<div class="pile-card is-empty" id="foeDeckPile" title="Next Enemy in Deck">' +
          '<div class="pile-art-wrap"><img id="foeDeckImg" src="assets/cards/art/nine-tail-prodigy.webp" alt=""></div>' +
          '<span class="pile-next-tag">NEXT</span>' +
          '<span class="pile-empty-ico">&mdash;</span>' +
          '<span class="pile-badge" id="foeDeckCnt">0</span>' +
          '<span class="pile-lbl">DECK</span>' +
        '</div>' +
        '<div class="pile-card grave is-empty" id="foeGravePile" title="Defeated Enemies">' +
          '<div class="pile-art-wrap"><img id="foeGraveImg" src="assets/cards/art/nine-tail-prodigy.webp" alt=""></div>' +
          '<span class="pile-next-tag">KO</span>' +
          '<span class="pile-empty-ico">&times;</span>' +
          '<span class="pile-badge" id="foeGraveCnt">0</span>' +
          '<span class="pile-lbl">GRAVE</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    syncPiles();
  }

  function getPlayerRosterState() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (b && Array.isArray(b.fighters) && b.fighters.length) {
      var act = b.active || 0;
      var rem = [];
      var grave = [];
      for (var i = 0; i < b.fighters.length; i++) {
        var f = b.fighters[i];
        if (!f) continue;
        var art = cardArtOf(f.char);
        var nm = cardNameOf(f.char);
        if (i < act || f.dead || (i === act && b.pHp <= 0 && b.over)) {
          grave.push({ art: art, name: nm });
        } else if (i > act) {
          rem.push({ art: art, name: nm });
        }
      }
      return { rem: rem, grave: grave };
    }
    var eqList = (typeof equippedList === 'function') ? equippedList() : [];
    var rem0 = [];
    for (var k = 1; k < eqList.length; k++) {
      if (eqList[k]) rem0.push({ art: cardArtOf(eqList[k].char), name: cardNameOf(eqList[k].char) });
    }
    return { rem: rem0, grave: [] };
  }

  function getFoeRosterState() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    var tRun = (typeof towerRun !== 'undefined') ? towerRun : null;
    if (isTowerMode() && tRun && Array.isArray(tRun.waves)) {
      var idx = tRun.idx || 0;
      var rem = [];
      var grave = [];
      for (var i = 0; i < tRun.waves.length; i++) {
        var w = tRun.waves[i];
        if (!w || !w.en) continue;
        var art = w.en.img || cardArtOf(w.eid);
        var nm = w.en.name || 'TARGET';
        if (i < idx || w.dead || (i === idx && b && b.eHp <= 0 && b.over)) {
          grave.push({ art: art, name: nm });
        } else if (i > idx) {
          rem.push({ art: art, name: nm });
        }
      }
      return { rem: rem, grave: grave };
    }
    /* Story / Raid: single enemy */
    var graveSingle = [];
    if (b && b.eHp <= 0 && b.en) {
      graveSingle.push({ art: b.en.img || cardArtOf(b.eid), name: b.en.name || 'TARGET' });
    }
    return { rem: [], grave: graveSingle };
  }

  function syncPiles() {
    if (!$('hzMatPiles')) return;
    var meState = getPlayerRosterState();
    var meDeckPile = $('meDeckPile');
    var meGravePile = $('meGravePile');
    if (meDeckPile) {
      $('meDeckCnt').textContent = String(meState.rem.length);
      meDeckPile.classList.toggle('is-empty', meState.rem.length === 0);
      meDeckPile.classList.toggle('has-stack', meState.rem.length > 1);
      if (meState.rem.length > 0 && $('meDeckImg')) {
        var wantMeD = meState.rem[0].art;
        if ($('meDeckImg').getAttribute('src') !== wantMeD) $('meDeckImg').src = wantMeD;
      }
    }
    if (meGravePile) {
      $('meGraveCnt').textContent = String(meState.grave.length);
      meGravePile.classList.toggle('is-empty', meState.grave.length === 0);
      meGravePile.classList.toggle('has-stack', meState.grave.length > 1);
      if (meState.grave.length > 0 && $('meGraveImg')) {
        var wantMeG = meState.grave[meState.grave.length - 1].art;
        if ($('meGraveImg').getAttribute('src') !== wantMeG) $('meGraveImg').src = wantMeG;
      }
    }

    var foeState = getFoeRosterState();
    var foeDeckPile = $('foeDeckPile');
    var foeGravePile = $('foeGravePile');
    if (foeDeckPile) {
      $('foeDeckCnt').textContent = String(foeState.rem.length);
      foeDeckPile.classList.toggle('is-empty', foeState.rem.length === 0);
      foeDeckPile.classList.toggle('has-stack', foeState.rem.length > 1);
      if (foeState.rem.length > 0 && $('foeDeckImg')) {
        var wantFoeD = foeState.rem[0].art;
        if ($('foeDeckImg').getAttribute('src') !== wantFoeD) $('foeDeckImg').src = wantFoeD;
      }
    }
    if (foeGravePile) {
      $('foeGraveCnt').textContent = String(foeState.grave.length);
      foeGravePile.classList.toggle('is-empty', foeState.grave.length === 0);
      foeGravePile.classList.toggle('has-stack', foeState.grave.length > 1);
      if (foeState.grave.length > 0 && $('foeGraveImg')) {
        var wantFoeG = foeState.grave[foeState.grave.length - 1].art;
        if ($('foeGraveImg').getAttribute('src') !== wantFoeG) $('foeGraveImg').src = wantFoeG;
      }
    }
  }

  /* -------------------------------------------- 4. FLYING CARD SWAP GHOSTS */
  function ensureSwapLayer() {
    var l = $('hzSwapLayer');
    if (!l) {
      l = mk('div', 'hz-swap-layer');
      l.id = 'hzSwapLayer';
      document.body.appendChild(l);
    }
    return l;
  }

  function extractCardVisual(info, isMe) {
    if (!info) return null;
    if (info.en) {
      return {
        art: info.en.img || cardArtOf(info.eid),
        name: info.en.name || 'TARGET'
      };
    }
    if (info.char) {
      return {
        art: cardArtOf(info.char),
        name: cardNameOf(info.char)
      };
    }
    if (info.img || info.art) {
      return {
        art: info.img || info.art,
        name: info.name || (isMe ? 'OPERATOR' : 'TARGET')
      };
    }
    return null;
  }

  function animateDeathAndSwap(side, fallenInfo, nextInfo) {
    var isMe = (side === 'me');
    var activeUnitEl = document.querySelector(isMe ? '.fighter.me' : '.fighter.foe');
    var gravePileEl  = $(isMe ? 'meGravePile' : 'foeGravePile');
    var deckPileEl   = $(isMe ? 'meDeckPile' : 'foeDeckPile');
    if (!activeUnitEl || !gravePileEl) return;

    var cardR  = activeUnitEl.getBoundingClientRect();
    var graveR = gravePileEl.getBoundingClientRect();
    if (!cardR.width || !graveR.width) return;

    var swapLayer = ensureSwapLayer();
    var fallenVis = extractCardVisual(fallenInfo, isMe) || (isMe ? activeMeInfo() : activeFoeInfo());
    var nextVis   = extractCardVisual(nextInfo, isMe);

    /* 1. Spawn Ghost Card at Active Card position -> Fly into GRAVE pile */
    var ghostOut = mk('div', 'swap-ghost to-grave' + (isMe ? '' : ' foe'));
    ghostOut.style.width = cardR.width + 'px';
    ghostOut.style.height = cardR.height + 'px';
    ghostOut.innerHTML =
      '<img src="' + esc(fallenVis.art) + '" alt="">' +
      '<div class="sg-tag">FALLEN // ' + esc(fallenVis.name) + '</div>';
    swapLayer.appendChild(ghostOut);

    if (nextVis) {
      activeUnitEl.style.opacity = '0';
    }

    var outDur = spdMs(460);
    if (typeof ghostOut.animate === 'function') {
      var dxG = (graveR.left + graveR.width / 2) - (cardR.left + cardR.width / 2);
      var scaleX = Math.max(0.18, graveR.width / cardR.width);
      var scaleY = Math.max(0.18, graveR.height / cardR.height);
      var endX = graveR.left + (graveR.width - cardR.width) / 2;
      var endY = graveR.top + (graveR.height - cardR.height) / 2;
      var animOut = ghostOut.animate([
        { transform: 'translate3d(' + cardR.left + 'px,' + cardR.top + 'px,0) scale(1) rotate(0deg)', opacity: 1, offset: 0 },
        { transform: 'translate3d(' + (cardR.left + dxG * 0.25) + 'px,' + (cardR.top - 24) + 'px,0) scale(0.82) rotate(' + (isMe ? -8 : 8) + 'deg)', opacity: 0.92, offset: 0.35 },
        { transform: 'translate3d(' + endX + 'px,' + endY + 'px,0) scale(' + scaleX.toFixed(3) + ',' + scaleY.toFixed(3) + ') rotate(' + (isMe ? -14 : 14) + 'deg)', opacity: 0.25, offset: 1 }
      ], { duration: outDur, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });
      animOut.finished.then(function () { try { ghostOut.remove(); } catch (e) {} }).catch(function () { try { ghostOut.remove(); } catch (e) {} });
    } else {
      setTimeout(function () { try { ghostOut.remove(); } catch (e) {} }, outDur);
    }

    /* Update Grave pile & pulse on arrival */
    setTimeout(function () {
      syncPiles();
      syncHud();
      if (gravePileEl && typeof gravePileEl.animate === 'function') {
        gravePileEl.animate([
          { transform: 'scale(1)' },
          { transform: 'scale(1.18)' },
          { transform: 'scale(1)' }
        ], { duration: spdMs(240), easing: 'ease-out' });
      }

      /* 2. If next card exists in DECK queue, spawn Ghost Card at DECK pile -> Fly into Active Card slot */
      if (!nextVis || !deckPileEl) return;
      var deckR = deckPileEl.getBoundingClientRect();
      if (!deckR.width) {
        activeUnitEl.style.opacity = '1';
        return;
      }
      var ghostIn = mk('div', 'swap-ghost' + (isMe ? '' : ' foe'));
      ghostIn.style.width = cardR.width + 'px';
      ghostIn.style.height = cardR.height + 'px';
      ghostIn.innerHTML =
        '<img src="' + esc(nextVis.art) + '" alt="">' +
        '<div class="sg-tag">DEPLOY // ' + esc(nextVis.name) + '</div>';
      swapLayer.appendChild(ghostIn);

      var inDur = spdMs(500);
      if (typeof ghostIn.animate === 'function') {
        var sX = Math.max(0.22, deckR.width / cardR.width);
        var sY = Math.max(0.22, deckR.height / cardR.height);
        var startX = deckR.left + (deckR.width - cardR.width) / 2;
        var startY = deckR.top + (deckR.height - cardR.height) / 2;
        var animIn = ghostIn.animate([
          { transform: 'translate3d(' + startX + 'px,' + startY + 'px,0) scale(' + sX.toFixed(3) + ',' + sY.toFixed(3) + ') rotate(' + (isMe ? -12 : 12) + 'deg)', opacity: 0.4, offset: 0 },
          { transform: 'translate3d(' + (cardR.left + (isMe ? -14 : 14)) + 'px,' + (cardR.top - 18) + 'px,0) scale(1.08) rotate(' + (isMe ? 4 : -4) + 'deg)', opacity: 1, offset: 0.72 },
          { transform: 'translate3d(' + cardR.left + 'px,' + cardR.top + 'px,0) scale(1) rotate(0deg)', opacity: 1, offset: 1 }
        ], { duration: inDur, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
        animIn.finished.then(function () {
          try { ghostIn.remove(); } catch (e) {}
          var liveEl = document.querySelector(isMe ? '.fighter.me' : '.fighter.foe');
          if (liveEl) { liveEl.classList.remove('ko'); liveEl.style.opacity = '1'; }
          if (typeof window.fxDeployBurst === 'function') {
            try { window.fxDeployBurst(cardR, isMe); } catch (e) {}
          }
        }).catch(function () {
          try { ghostIn.remove(); } catch (e) {}
          var liveEl = document.querySelector(isMe ? '.fighter.me' : '.fighter.foe');
          if (liveEl) { liveEl.classList.remove('ko'); liveEl.style.opacity = '1'; }
          if (typeof window.fxDeployBurst === 'function') {
            try { window.fxDeployBurst(cardR, isMe); } catch (e) {}
          }
        });
      } else {
        setTimeout(function () {
          try { ghostIn.remove(); } catch (e) {}
          var liveEl = document.querySelector(isMe ? '.fighter.me' : '.fighter.foe');
          if (liveEl) { liveEl.classList.remove('ko'); liveEl.style.opacity = '1'; }
          if (typeof window.fxDeployBurst === 'function') {
            try { window.fxDeployBurst(cardR, isMe); } catch (e) {}
          }
        }, inDur);
      }
    }, outDur);
  }

  /* -------------------------------------------- 5. BOTTOM-LEFT PARTY TRAY */
  function buildPartyRail() {
    drop('hzPartyRail');
    var wrap = mk('div', 'party-dock');
    wrap.id = 'hzPartyRail';
    wrap.innerHTML =
      '<div class="party-title">YOUR PARTY</div>' +
      '<div class="party-tray" id="hzPartyTray"></div>';
    document.body.appendChild(wrap);
    syncPartyRail();
  }

  function syncPartyRail() {
    var tray = $('hzPartyTray');
    if (!tray) return;
    var b = (typeof bt !== 'undefined') ? bt : null;
    var r = (typeof raid !== 'undefined') ? raid : null;
    var list = [];
    var active = 0;

    if (b && Array.isArray(b.fighters) && b.fighters.length) {
      list = b.fighters.slice(0, 4);
      active = b.active || 0;
    } else if (r && r.boss) {
      var eqR = (typeof raidPicked !== 'undefined' && raidPicked) ? raidPicked : (typeof equipped === 'function' ? equipped() : null);
      if (eqR) list = [eqR];
    } else if (typeof equippedList === 'function') {
      list = equippedList().slice(0, 4);
    }

    var html = '';
    for (var i = 0; i < 4; i++) {
      var f = list[i] || null;
      if (f && f.char) {
        var dead = false;
        var pct = 1;
        if (b) {
          dead = (i < active) || !!f.dead || (i === active && !(b.pHp > 0));
          if (i === active && b.pMax) pct = Math.max(0, Math.min(1, b.pHp / b.pMax));
          else if (dead) pct = 0;
        }
        var cls = 'pt-slot' + (i === active ? ' active' : '') + (dead ? ' dead' : '') + (f.sk ? ' shadow-sq' : '');
        html +=
          '<div class="' + cls + '" data-slot="' + i + '" title="' + esc(cardNameOf(f.char)) + '">' +
            '<img src="' + esc(cardThumbOf(f.char)) + '" alt="">' +
            '<span class="num">' + (i + 1) + '</span>' +
            '<span class="ko-tag">KO</span>' +
            '<div class="bar"><i style="transform:scaleX(' + (dead ? 0 : pct).toFixed(2) + ')"></i></div>' +
          '</div>';
      } else {
        html +=
          '<div class="pt-slot empty" data-slot="' + i + '">' +
            '<span class="num">' + (i + 1) + '</span>' +
            '<div class="bar"><i style="transform:scaleX(0)"></i></div>' +
          '</div>';
      }
    }
    if (tray.getAttribute('data-cache') !== html) {
      tray.setAttribute('data-cache', html);
      tray.innerHTML = html;
    }
  }

  /* -------------------------------------------- 6. ENEMY LINE-UP TRAY */
  function syncFoeLineup() {
    var tray = $('hzFoeLineupTray');
    if (!tray) return;
    var b = (typeof bt !== 'undefined') ? bt : null;
    var tRun = (typeof towerRun !== 'undefined') ? towerRun : null;
    var html = '';
    var foeAlive = 1;

    if (isTowerMode() && tRun && Array.isArray(tRun.waves) && tRun.waves.length) {
      var idx = tRun.idx || 0;
      foeAlive = 0;
      for (var i = 0; i < tRun.waves.length && i < 4; i++) {
        var w = tRun.waves[i];
        if (!w || !w.en) continue;
        var dead = (i < idx) || !!w.dead || (i === idx && b && b.eHp <= 0);
        if (!dead) foeAlive++;
        var mx = (w.es && w.es.hp) || 1;
        var hp = (i === idx && b && b.eHp != null) ? Math.max(0, b.eHp) : (w.hp != null ? Math.max(0, w.hp) : mx);
        var pct = dead ? 0 : Math.max(0, Math.min(1, hp / mx));
        var cls = 'foe-slot' + (i === idx ? ' active' : '') + (dead ? ' dead' : '');
        html +=
          '<div class="' + cls + '" data-fslot="' + i + '" title="' + esc(w.en.name || '') + '">' +
            '<img src="' + esc(w.en.img || cardArtOf(w.eid)) + '" alt="">' +
            '<span class="idx">' + (i + 1) + '</span>' +
            '<div class="mini-hp"><i style="transform:scaleX(' + pct.toFixed(2) + ')"></i></div>' +
          '</div>';
      }
    } else {
      var foe = activeFoeInfo();
      var deadSingle = foe.hp <= 0;
      foeAlive = deadSingle ? 0 : 1;
      var pctSingle = deadSingle ? 0 : Math.max(0, Math.min(1, foe.hp / Math.max(1, foe.max)));
      html +=
        '<div class="foe-slot active' + (deadSingle ? ' dead' : '') + '" data-fslot="0" title="' + esc(foe.name) + '">' +
          '<img src="' + esc(foe.art) + '" alt="">' +
          '<span class="idx">1</span>' +
          '<div class="mini-hp"><i style="transform:scaleX(' + pctSingle.toFixed(2) + ')"></i></div>' +
        '</div>';
    }

    if (tray.getAttribute('data-cache') !== html) {
      tray.setAttribute('data-cache', html);
      tray.innerHTML = html;
    }

    var foePips = $('hudFoePips') ? $('hudFoePips').querySelectorAll('.hud-pip') : [];
    for (var p = 0; p < foePips.length; p++) {
      foePips[p].classList.toggle('on', p < foeAlive);
    }
  }

  /* -------------------------------------------- 7. BOTTOM-RIGHT CONTROL RAIL */
  function buildActRail() {
    drop('hzActRail');
    var wrap = mk('div', 'ctrl-rail');
    wrap.id = 'hzActRail';
    wrap.innerHTML =
      '<button class="ctrl-btn c-bg" id="hzBtnBg" type="button">' +
        '<span>Background: ' + (bgOn ? 'On' : 'Off') + '</span>' +
        '<em class="kb">B</em>' +
      '</button>' +
      '<button class="ctrl-btn c-restart" id="hzBtnRestart" type="button">' +
        '<span>&#8635; Restart: OFF</span>' +
        '<em class="kb">T</em>' +
      '</button>' +
      '<button class="ctrl-btn c-speed" id="hzSpeed" type="button">' +
        '<span>&laquo; 1x Speed</span>' +
        '<em class="kb">X</em>' +
      '</button>' +
      '<button class="ctrl-btn c-end" id="hzEnd" type="button">' +
        '<span>&times; End Battle</span>' +
        '<em class="kb">E</em>' +
      '</button>';
    document.body.appendChild(wrap);

    var btnBg = $('hzBtnBg');
    if (btnBg) {
      btnBg.onclick = function () {
        bgOn = !bgOn;
        var a = $('hzArena');
        if (a) a.classList.toggle('bg-off', !bgOn);
        btnBg.firstElementChild.textContent = 'Background: ' + (bgOn ? 'On' : 'Off');
        showHzToast('BACKGROUND // ' + (bgOn ? 'ON' : 'OFF'));
      };
    }

    var btnRestart = $('hzBtnRestart');
    if (btnRestart) {
      btnRestart.onclick = function () {
        if (typeof state === 'undefined' || !state) return;
        state.tower = state.tower || { best: 0 };
        state.tower.auto = !state.tower.auto;
        try { if (typeof save === 'function') save(); } catch (e) {}
        syncActRail();
        showHzToast('TOWER AUTO RESTART // ' + (state.tower.auto ? 'ON' : 'OFF'));
      };
    }

    var btnSpd = $('hzSpeed');
    if (btnSpd) {
      btnSpd.onclick = function () {
        var cur = (typeof battleSpeedEff === 'function') ? battleSpeedEff() : 1;
        var max = (typeof battleSpeedMax === 'function') ? battleSpeedMax() : 2;
        if (max <= 1) {
          try { if (typeof toast === 'function') toast('SPEED LOCKED', 'Unlock in Premium Shop', '#f3e600'); } catch (e) {}
          showHzToast('SPEED LOCKED // PREMIUM SHOP');
          return;
        }
        var next = cur >= max ? 1 : cur + 1;
        state.battleSpeed = next;
        try { if (typeof save === 'function') save(); } catch (e) {}
        if (typeof bt !== 'undefined' && bt) bt.speed = battleSpeedEff();
        try { if (window.CyberSfx && window.CyberSfx.katanaSlash) window.CyberSfx.katanaSlash(1.3); } catch (e) {}
        syncActRail();
        showHzToast('BATTLE SPEED // ' + next + 'x');
      };
    }

    var btnEnd = $('hzEnd');
    if (btnEnd) {
      btnEnd.onclick = function () {
        if (typeof window.leaveBattleToLobby === 'function') { window.leaveBattleToLobby(); return; }
        var exitBtn = document.getElementById('bfExit');
        if (exitBtn) exitBtn.click();
      };
    }

    syncActRail();
  }

  function syncActRail() {
    var btnRestart = $('hzBtnRestart');
    if (btnRestart) {
      var onTw = isTowerMode();
      btnRestart.hidden = !onTw;
      var autoOn = !!(typeof state !== 'undefined' && state && state.tower && state.tower.auto);
      btnRestart.classList.toggle('on', autoOn);
      if (btnRestart.firstElementChild) {
        btnRestart.firstElementChild.innerHTML = '&#8635; Restart: ' + (autoOn ? 'ON' : 'OFF');
      }
    }
    var sp = $('hzSpeed');
    if (sp && sp.firstElementChild) {
      var b = (typeof bt !== 'undefined') && bt ? bt : null;
      var maxSpd = (typeof battleSpeedMax === 'function') ? battleSpeedMax() : 2;
      var rawSpd = b ? (b.speed || 1) : ((typeof battleSpeedEff === 'function') ? battleSpeedEff() : 1);
      var spd = Math.min(rawSpd, maxSpd);
      var txt = '\u00ab ' + spd + 'x Speed';
      if (sp.firstElementChild.textContent !== txt) sp.firstElementChild.textContent = txt;
    }
  }

  /* -------------------------------------------- 8. TOAST & LIVE HUD SYNC */
  function showHzToast(msg) {
    var t = $('hzBattleToast');
    if (!t) {
      t = mk('div', 'hz-battle-toast');
      t.id = 'hzBattleToast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function syncHud() {
    if (!$('hzHud')) return;
    var info = battleInfo();
    var me = activeMeInfo();
    var foe = activeFoeInfo();

    if ($('hcKick') && $('hcKick').innerHTML !== info.kick) $('hcKick').innerHTML = info.kick;
    if ($('hcTitle') && $('hcTitle').textContent !== info.title) $('hcTitle').textContent = info.title;

    if ($('hudMeAva') && me.art && $('hudMeAva').getAttribute('src') !== me.art) $('hudMeAva').src = me.art;
    if ($('hudMeName')) $('hudMeName').textContent = me.name;
    if ($('hudMeHpNum')) $('hudMeHpNum').textContent = fmtNum(me.hp);
    if ($('hudTurn')) $('hudTurn').textContent = 'TURN ' + (me.turn || 1);

    if ($('hudFoeAva') && foe.art && $('hudFoeAva').getAttribute('src') !== foe.art) $('hudFoeAva').src = foe.art;
    if ($('hudFoeName')) $('hudFoeName').textContent = foe.name;
    if ($('hudFoeHpNum')) $('hudFoeHpNum').textContent = fmtNum(foe.hp);
    if ($('coTitle')) $('coTitle').textContent = foe.coTitle;
    if ($('coSub')) $('coSub').textContent = foe.coSub;

    /* Player alive pips */
    var b = (typeof bt !== 'undefined') ? bt : null;
    var meAlive = 1;
    if (b && Array.isArray(b.fighters)) {
      var act = b.active || 0;
      meAlive = 0;
      for (var i = 0; i < b.fighters.length; i++) {
        var f = b.fighters[i];
        if (!f) continue;
        var dead = (i < act) || !!f.dead || (i === act && !(b.pHp > 0));
        if (!dead) meAlive++;
      }
    }
    var mePips = $('hudMePips') ? $('hudMePips').querySelectorAll('.hud-pip') : [];
    for (var m = 0; m < mePips.length; m++) {
      mePips[m].classList.toggle('on', m < meAlive);
    }

    syncPartyRail();
    syncFoeLineup();
    syncPiles();
    syncActRail();
  }

  function tickClock() {
    var timerEl = $('hcTimer');
    if (!timerEl) return;
    var b = (typeof bt !== 'undefined') ? bt : null;
    var t0 = (b && b.t0) ? b.t0 : (battleStartMs || Date.now());
    var secs = Math.max(0, Math.floor((Date.now() - t0) / 1000));
    timerEl.textContent = pad2(Math.floor(secs / 60)) + ':' + pad2(secs % 60);
  }

  /* -------------------------------------------- 9. ENTRY / EXIT CURTAIN */
  function buildCurtain() {
    var c = $('hzCurtain');
    if (c) return c;
    c = mk('div', 'hz-curtain');
    c.id = 'hzCurtain';
    c.setAttribute('aria-hidden', 'true');
    c.innerHTML =
      '<div class="hz-ct-half hz-ct-top"><span class="hz-ct-edge"></span>' +
        '<span class="hz-ct-mark">SECTOR <b id="hzCtMark">03</b> / 05</span></div>' +
      '<div class="hz-ct-half hz-ct-bot"><span class="hz-ct-edge"></span>' +
        '<span class="hz-ct-mark">HZ-PROTOCOL <b>871</b></span></div>' +
      '<div class="hz-ct-tape hz-ct-tape--a"></div>' +
      '<div class="hz-ct-tape hz-ct-tape--b"></div>' +
      '<div class="hz-ct-flash"></div>' +
      '<div class="hz-ct-plate">' +
        '<span class="hz-ct-corner hz-ct-corner--tl"></span>' +
        '<span class="hz-ct-corner hz-ct-corner--tr"></span>' +
        '<span class="hz-ct-corner hz-ct-corner--bl"></span>' +
        '<span class="hz-ct-corner hz-ct-corner--br"></span>' +
        '<span class="hz-ct-water" id="hzCtWater">BATTLE</span>' +
        '<div class="hz-ct-in">' +
          '<div class="hz-ct-kickrow"><span class="hz-ct-dot"></span>' +
            '<span class="hz-ct-kick" id="hzCtKick">// AUTHORIZED <b>INSERTION</b></span>' +
            '<span class="hz-ct-serial">SERIAL 0x<span id="hzCtSerial">1A7F</span></span></div>' +
          '<div class="hz-ct-title" id="hzCtTitle"><span>STAGE</span></div>' +
          '<div class="hz-ct-sub" id="hzCtSub">ENGAGE TARGET</div>' +
          '<div class="hz-ct-bar"><i></i></div>' +
          '<div class="hz-ct-foot"><span>HZ-PROTOCOL</span><span id="hzCtFoot">ENGAGE TARGET</span></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(c);
    return c;
  }

  function curtainCopy(kind) {
    var info = battleInfo();
    var serial = (0x1000 + Math.floor(Math.random() * 0xefff)).toString(16).toUpperCase();
    var title = info.title;
    var sub, kick, water, foot, mark;

    if (info.mode === 'tower') {
      mark = '07';
      sub = 'CORE SPIRE - GUARD FLOOR';
      kick = '// SPIRE <b>ASCENT</b>';
      water = 'TOWER';
      foot = 'ENTER FLOOR';
    } else if (info.mode === 'raid') {
      mark = 'WB';
      sub = 'RAID - PHASE DEPLOYMENT';
      kick = '// RAID <b>DEPLOYMENT</b>';
      water = 'RAID';
      foot = 'ENGAGE TARGET';
    } else {
      mark = '03';
      sub = 'SECTOR ' + pad2((typeof bt !== 'undefined' && bt && bt.lv) || 1) + ' - BATTLE GATE';
      kick = '// AUTHORIZED <b>INSERTION</b>';
      water = 'STORY';
      foot = 'ENGAGE TARGET';
    }

    if (kind === 'out') {
      kick = '// EXTRACTION <b>PROTOCOL</b>';
      title = 'EXIT';
      sub = info.mode === 'tower' ? 'SPIRE RUN CLOSED'
        : info.mode === 'raid' ? 'RAID RUN SUBMITTED' : 'SECTOR CLEARED';
      water = 'OUT';
      foot = 'RETURN TO HUB';
    }

    var setT = function (id, v) { var n = $(id); if (n) n.textContent = v; };
    setT('hzCtMark', mark);
    setT('hzCtSerial', serial);
    setT('hzCtSub', sub);
    setT('hzCtWater', water);
    setT('hzCtFoot', foot);

    var k = $('hzCtKick');
    if (k) k.innerHTML = kick;
    var tt = $('hzCtTitle');
    if (tt) tt.innerHTML = '<span>' + esc(title) + '</span>';
  }

  function reveal() {
    var c = $('hzCurtain');
    if (!c) return;
    c.classList.add('smooth', 'revealed', 'sweep');
    timers.push(setTimeout(function () { c.classList.remove('sweep'); }, 1600));
    timers.push(setTimeout(function () { c.classList.remove('smooth'); }, 760));
    timers.push(setTimeout(function () { c.classList.remove('on'); }, 1250));
  }

  function curtainIn(cb, hold) {
    clearTimers();
    var info = battleInfo();
    // Di mode story, animasi masuk battle ditiadakan sesuai instruksi user
    if (info && info.mode === 'story') {
      var c = $('hzCurtain');
      if (c) c.className = '';
      if (typeof cb === 'function') {
        try { cb(); } catch (e) { console.error('hzCurtainIn cb', e); }
      }
      return;
    }
    var c = buildCurtain();
    c.classList.remove('smooth', 'revealed', 'sweep');
    c.classList.add('on');
    curtainCopy('in');
    void c.offsetWidth;
    timers.push(setTimeout(function () {
      if (typeof cb === 'function') {
        try { cb(); } catch (e) { console.error('hzCurtainIn cb', e); }
      }
    }, 80));
    timers.push(setTimeout(reveal, hold == null ? 620 : hold));
  }

  function curtainOut(cb) {
    var c = buildCurtain();
    clearTimers();
    curtainCopy('out');
    c.className = '';
    c.classList.add('on', 'smooth', 'revealed');
    void c.offsetWidth;
    c.classList.remove('revealed');
    timers.push(setTimeout(function () {
      if (typeof cb === 'function') {
        try { cb(); } catch (e) { console.error('hzCurtainOut cb', e); }
      }
    }, 560));
    timers.push(setTimeout(function () {
      c.classList.add('revealed');
    }, 780));
    timers.push(setTimeout(function () {
      c.classList.remove('on', 'smooth', 'revealed');
    }, 1560));
  }

  /* -------------------------------------------- 10. LIFECYCLE & SYNC */
  function teardown() {
    drop('hzArena');
    drop('hzHud');
    drop('hzPartyRail');
    drop('hzPileStrip');
    drop('hzMatPiles');
    drop('hzActRail');
    drop('hzSwapLayer');
    drop('hzBattleToast');
  }

  function sync() {
    if (!document.body.classList.contains('battle-full')) {
      teardown();
      return;
    }
    if (!$('hzArena')) buildArena();
    if (!$('hzHud')) buildHud();
    if (!$('hzMatPiles')) buildPiles();
    if (!$('hzPartyRail')) buildPartyRail();
    if (!$('hzActRail')) buildActRail();
    ensureSwapLayer();
    syncHud();
    tickClock();
  }

  function decorate() {
    battleStartMs = Date.now();
    buildArena();
    buildHud();
    buildPiles();
    buildPartyRail();
    buildActRail();
    ensureSwapLayer();
    tickClock();
  }

  /* Keyboard shortcuts inside battle: B (Bg), T (Restart in Tower), X (Speed), E (End) */
  window.addEventListener('keydown', function (e) {
    if (!document.body || !document.body.classList.contains('battle-full')) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    var k = (e.key || '').toUpperCase();
    if (k === 'B' && $('hzBtnBg')) $('hzBtnBg').click();
    else if (k === 'T' && $('hzBtnRestart') && !$('hzBtnRestart').hidden) $('hzBtnRestart').click();
    else if (k === 'X' && $('hzSpeed')) $('hzSpeed').click();
    else if (k === 'E' && $('hzEnd')) $('hzEnd').click();
  });

  syncT = setInterval(sync, 350);
  clockT = setInterval(function () {
    if (document.body && document.body.classList.contains('battle-full')) tickClock();
  }, 1000);
  if (syncT && syncT.unref) syncT.unref();
  if (clockT && clockT.unref) clockT.unref();

  window.hzBattleDecorate = decorate;
  window.hzBattleSync = sync;
  window.hzCurtainIn = curtainIn;
  window.hzCurtainOut = curtainOut;
  window.hzAnimateDeathAndSwap = animateDeathAndSwap;
})();
