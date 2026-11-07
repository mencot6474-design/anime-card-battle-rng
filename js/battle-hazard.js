/* ==========================================================================
   BATTLE HAZARD — layer visual arena battle (port prototipe hazard WoB).
   Tidak menyentuh logika battle. Hanya menambah/menata elemen dekoratif:
     .hz-arena   latar void + grid lantai + vignette + pita hazard
     .hz-hud     HUD atas: kicker / judul / fase
     .hz-party   party rail (4 slot, aktif/mati)
     .hz-piles   deck + grave counter
     #hzCurtain  banner masuk/keluar hazard
   Dipanggil dari renderBattle()/renderTowerBattle() lewat window.hzBattleDecorate().
   Kontrak performa: transform/opacity saja, canvas tidak dipakai, tanpa
   backdrop-filter di permukaan besar.
   ========================================================================== */
(function () {
  'use strict';

  var timers = [];
  var syncT = 0;

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

  /* ------------------------------------------------------------- ARENA BG */
  function buildArena() {
    if (typeof state !== 'undefined' && state && state.customBg) { /* tidak dipakai */ }
    if ($('hzArena')) return;
    var a = mk('div', 'hz-arena');
    a.id = 'hzArena';
    a.innerHTML =
      '<div class="hz-bg"></div>' +
      '<div class="hz-floor"></div>' +
      '<div class="hz-vig"></div>' +
      '<div class="hz-grain"></div>' +
      '<div class="hz-tape"></div>';
    document.body.appendChild(a);
  }

  /* ------------------------------------------------------------------ HUD */
  function battleInfo() {
    var info = { mode: 'story', kick: 'STORY PROTOCOL', title: 'ENGAGEMENT', phase: 'PLAYER INITIATIVE' };
    var b = (typeof bt !== 'undefined') ? bt : null;

    if (b && b.tower && typeof towerRun !== 'undefined' && towerRun) {
      info.mode = 'tower';
      info.kick = 'INFINITE TOWER &middot; <b>CORE SPIRE</b>';
      info.title = 'FLOOR ' + (towerRun.floor || 1);
      info.phase = (typeof towerIsBossFloor === 'function' && towerIsBossFloor(towerRun.floor))
        ? 'BOSS ENCOUNTER'
        : 'WAVE ' + ((towerRun.idx || 0) + 1) + '/' + ((towerRun.waves || []).length || 1);
    } else if (b && b.lv != null) {
      info.mode = 'story';
      info.kick = 'STORY PROTOCOL &middot; <b>SECTOR ' + String(b.lv).padStart(2, '0') + '</b>';
      info.title = 'STAGE ' + b.lv;
      info.phase = 'PLAYER INITIATIVE';
    } else if (b && b.en) {
      info.mode = 'raid';
      info.kick = 'WORLD BOSS &middot; <b>RAID DEPLOYMENT</b>';
      info.title = (b.en && b.en.name) || 'WORLD BOSS';
      info.phase = 'RAID PHASE II';
    }
    return info;
  }

  function buildHud() {
    drop('hzHud');
    var info = battleInfo();
    var hud = mk('div', 'hz-hud');
    hud.id = 'hzHud';
    hud.innerHTML =
      '<div class="hz-hud-card">' +
        '<div class="hz-kick">' + info.kick + '</div>' +
        '<div class="hz-title">' + esc(info.title) + '</div>' +
        '<div class="hz-sub"><span class="hz-dot"></span>' +
          '<span class="hz-phase">' + esc(info.phase) + '</span></div>' +
      '</div>';
    document.body.appendChild(hud);
  }

  /* ------------------------------------------------------------ PARTY RAIL */
  function buildParty() {
    drop('hzParty');
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (!b || !b.fighters || !b.fighters.length) return;

    var row = '';
    var active = b.active || 0;
    for (var i = 0; i < b.fighters.length && i < 4; i++) {
      var f = b.fighters[i];
      if (!f) continue;
      var dead = (i === active) ? !(b.pHp > 0) : !!(b.revUsed && b.revUsed[i]);
      var img = '';
      try {
        if (typeof cardThumb === 'function') img = cardThumb(f.char);
        else if (typeof cardImg === 'function') img = cardImg(f.char);
      } catch (e) { img = ''; }
      row += '<div class="hz-pt' + (i === active ? ' active' : '') + (dead ? ' dead' : '') + '" data-i="' + i + '">' +
        (img ? '<img src="' + esc(img) + '" alt="">' : '') +
        '<span>' + (i + 1) + '</span><i><b></b></i></div>';
    }
    if (!row) return;

    var wrap = mk('div', 'hz-party');
    wrap.id = 'hzParty';
    wrap.innerHTML = '<div class="hz-party-h">YOUR PARTY</div>' +
      '<div class="hz-party-row">' + row + '</div>';
    document.body.appendChild(wrap);
  }

  /* --------------------------------------------------------------- PILES */
  function buildPiles() {
    drop('hzPiles');
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (!b) return;
    var total = (b.fighters || []).length;
    var active = b.active || 0;
    var left = Math.max(0, total - active - 1);

    var wrap = mk('div', 'hz-piles');
    wrap.id = 'hzPiles';
    wrap.innerHTML =
      '<div class="hz-pile"><b>DECK</b><span>&times;' + left + '</span><em>' + left + '</em></div>' +
      '<div class="hz-pile grave"><b>DOWN</b><span>&times;' + active + '</span><em>' + active + '</em></div>';
    document.body.appendChild(wrap);
  }

  /* ------------------------------------------------------------ CURTAIN */
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
      sub = 'CORE SPIRE \u2014 GUARD FLOOR';
      kick = '// SPIRE <b>ASCENT</b>';
      water = 'TOWER';
      foot = 'ENTER FLOOR';
    } else if (info.mode === 'raid') {
      mark = 'WB';
      sub = 'RAID \u2014 PHASE DEPLOYMENT';
      kick = '// RAID <b>DEPLOYMENT</b>';
      water = 'RAID';
      foot = 'ENGAGE TARGET';
    } else {
      mark = '03';
      sub = 'SECTOR ' + String((function () {
        var b = (typeof bt !== 'undefined') ? bt : null;
        return (b && b.lv) || 1;
      })()).padStart(2, '0') + ' \u2014 BATTLE GATE';
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

    var setT = function (id, v) {
      var n = $(id);
      if (n) n.textContent = v;
    };
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

  /* Banner masuk: layar tertutup -> cb dipanggil (render/audio) -> terbuka. */
  function curtainIn(cb, hold) {
    var c = buildCurtain();
    clearTimers();
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

  /* Banner keluar: layar menutup -> cb dipanggil -> terbuka. */
  function curtainOut(cb) {
    var c = buildCurtain();
    clearTimers();
    curtainCopy('out');
    c.classList.remove('smooth', 'revealed', 'sweep');
    c.classList.add('on');
    void c.offsetWidth;
    timers.push(setTimeout(function () {
      if (typeof cb === 'function') {
        try { cb(); } catch (e) { console.error('hzCurtainOut cb', e); }
      }
    }, 430));
    timers.push(setTimeout(reveal, 470));
  }

  /* --------------------------------------------------------------- SYNC */
  function sync() {
    if (!document.body.classList.contains('battle-full')) {
      drop('hzArena'); drop('hzHud'); drop('hzParty'); drop('hzPiles');
      return;
    }
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (!b) return;

    if (!$('hzArena')) buildArena();
    if (!$('hzHud')) buildHud();
    if (!$('hzParty') || $('hzParty').childElementCount === 0) buildParty();
    if (!$('hzPiles')) buildPiles();

    /* party: cukup ubah kelas (anti-flicker) */
    var pts = document.querySelectorAll('#hzParty .hz-pt');
    var active = b.active || 0;
    for (var i = 0; i < pts.length; i++) {
      var idx = parseInt(pts[i].getAttribute('data-i'), 10);
      var dead = (idx === active) ? !(b.pHp > 0) : !!(b.revUsed && b.revUsed[idx]);
      pts[i].classList.toggle('active', idx === active);
      pts[i].classList.toggle('dead', dead);
      var bar = pts[i].querySelector('i b');
      if (bar) {
        var pct = 1;
        if (idx === active && b.pMax) pct = Math.max(0, Math.min(1, b.pHp / b.pMax));
        bar.style.transform = 'scaleX(' + (dead ? 0 : pct) + ')';
      }
    }

    /* piles */
    var pile = $('#hzPiles .hz-pile em');
    if (pile) {
      var total = (b.fighters || []).length;
      var left = Math.max(0, total - active - 1);
      if (pile.textContent !== String(left)) {
        pile.textContent = left;
        var span = pile.parentNode.querySelector('span');
        if (span) span.innerHTML = '&times;' + left;
      }
    }
  }

  function decorate() {
    buildArena();
    buildHud();
    buildParty();
    buildPiles();
  }

  /* -------------------------------------------------------------- BOOT */
  syncT = setInterval(sync, 400);
  if (syncT && syncT.unref) syncT.unref();

  window.hzBattleDecorate = decorate;
  window.hzBattleSync = sync;
  window.hzCurtainIn = curtainIn;
  window.hzCurtainOut = curtainOut;
})();
