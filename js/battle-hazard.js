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

    /* Banner masuk tampil SEBELUM startBattle() membuat bt, jadi saat itu
       bt belum ada. Ambil konteks dari state/towerRun/raid. */
    if (!b) {
      var lvl = (typeof state !== 'undefined' && state && state.battle)
        ? state.battle.level : null;
      var tRun = (typeof towerRun !== 'undefined') ? towerRun : null;
      var rBoss = (typeof raid !== 'undefined' && raid) ? raid.boss : null;
      if (typeof tRun !== 'undefined' && tRun && tRun.waves) {
        info.mode = 'tower';
        info.kick = 'INFINITE TOWER &middot; <b>CORE SPIRE</b>';
        info.title = 'FLOOR ' + (tRun.floor || 1);
        info.phase = (typeof towerIsBossFloor === 'function' && towerIsBossFloor(tRun.floor))
          ? 'BOSS ENCOUNTER'
          : 'WAVE ' + ((tRun.idx || 0) + 1) + '/' + ((tRun.waves || []).length || 1);
        return info;
      }
      if (rBoss) {
        info.mode = 'raid';
        info.kick = 'WORLD BOSS &middot; <b>RAID DEPLOYMENT</b>';
        info.title = rBoss.name || 'WORLD BOSS';
        info.phase = 'RAID PHASE II';
        return info;
      }
      if (lvl != null) {
        info.mode = 'story';
        info.kick = 'STORY PROTOCOL &middot; <b>SECTOR ' + String(lvl).padStart(2, '0') + '</b>';
        info.title = 'STAGE ' + lvl;
        info.phase = 'PLAYER INITIATIVE';
        return info;
      }
    }

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

  /* ------------------------------------------------- INFO KARTU (untuk HUD) */
  function fmtChance(n) {
    if (!n) return '';
    return '1 IN ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function activeFighter() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (!b || !b.fighters) return null;
    return b.fighters[b.active || 0] || b.fighters[0] || null;
  }
  function overlayInfoMe() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    var f = activeFighter();
    if (!f && b && b.eq) f = b.eq;
    if (!f || !f.char) return null;
    var cd = null;
    try { cd = (typeof CARDS !== 'undefined') ? CARDS[f.char] : null; } catch (e) {}
    var nm = '';
    try { nm = cardName(f.char); } catch (e) {}
    return {
      char: f.char, mut: f.mut, trait: f.trait, shiny: !!f.shiny,
      name: nm, tag: 'OPERATOR', side: 'me',
      chance: cd && cd.chance ? cd.chance : 0,
      skill: cd && cd.passive && cd.passive.name ? cd.passive.name : ''
    };
  }
  function overlayInfoFoe() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (!b) return null;
    var en = b.en || null;
    var wave = null;
    try {
      if (typeof towerRun !== 'undefined' && towerRun && towerRun.waves) {
        wave = towerRun.waves[towerRun.idx] || null;
      }
    } catch (e) {}
    var wEn = wave && wave.en ? wave.en : null;
    var name = (en && en.name) || (wEn && wEn.name) || '';
    if (!name) return null;
    var mut = null;
    try { if (typeof diffOf === 'function') mut = diffOf().mut; } catch (e) {}
    var cid = (en && (en.char || en.id)) || (wEn && (wEn.char || wEn.id)) || b.eid || null;
    /* story: unit kartu musuh ada di STORY_BIBLE.levels[lv-1].unit */
    if (!cid) {
      try {
        if (b.lv != null && typeof STORY_BIBLE !== 'undefined' && STORY_BIBLE.levels) {
          var lvRec = STORY_BIBLE.levels[b.lv - 1];
          if (lvRec && lvRec.unit) cid = lvRec.unit;
        }
      } catch (e) {}
    }
    var cd = null;
    try { if (cid && typeof CARDS !== 'undefined') cd = CARDS[cid]; } catch (e) {}
    if (!cd && typeof CARDS !== 'undefined') {
      try {
        for (var k in CARDS) {
          if (CARDS[k] && CARDS[k].name === name) { cid = k; cd = CARDS[k]; break; }
        }
      } catch (e) {}
    }
    var isBoss = !!(en && en.boss) || !!(wave && wave.boss);
    return {
      char: cid, mut: mut, trait: null, shiny: false,
      name: name, tag: isBoss ? 'BOSS' : 'TARGET', side: 'foe',
      chance: cd && cd.chance ? cd.chance : 0,
      skill: cd && cd.passive && cd.passive.name ? cd.passive.name : ''
    };
  }

  /* ------------------------------------------------ ANGKA DI DALAM HP BAR */
  /* Prototipe menampilkan "cur / max" DI DALAM bar. Markup mesin hanya punya
     <i> + <div class="hp-trail">, jadi label ditambahkan sebagai span. */
  function decorateHpLabels() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    var meBar = document.querySelector('.fighter.me .hpbar');
    var foeBar = document.querySelector('.fighter.foe .hpbar');
    if (meBar && !meBar.querySelector('.hz-hp-txt')) {
      var s1 = document.createElement('span');
      s1.className = 'hz-hp-txt';
      meBar.appendChild(s1);
    }
    if (foeBar && !foeBar.querySelector('.hz-hp-txt')) {
      var s2 = document.createElement('span');
      s2.className = 'hz-hp-txt';
      foeBar.appendChild(s2);
    }
    if (!b) return;
    var mt = meBar && meBar.querySelector('.hz-hp-txt');
    var ft = foeBar && foeBar.querySelector('.hz-hp-txt');
    if (mt) mt.textContent = hpTxt(b.pHp, b.pMax);
    if (ft) ft.textContent = hpTxt(b.eHp != null ? b.eHp : foeMaxHp(), foeMaxHp());
  }

  function cardArt(charId) {
    try {
      if (charId && typeof cardImg === 'function') return cardImg(charId);
    } catch (e) {}
    return '';
  }
  function hpPctMe() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (!b || !b.pMax) return 1;
    return Math.max(0, Math.min(1, b.pHp / b.pMax));
  }
  function foeMaxHp() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (!b) return 0;
    if (b.es && b.es.hp) return b.es.hp;
    if (b.en && b.en.hp) return b.en.hp;
    return 0;
  }
  function hpPctFoe() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    var mx = foeMaxHp();
    if (!b || !mx) return 1;
    return Math.max(0, Math.min(1, (b.eHp != null ? b.eHp : mx) / mx));
  }
  function hpTxt(v, max) {
    function f(n) {
      n = Math.max(0, Math.round(n || 0));
      if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
      return String(n);
    }
    return f(v) + ' / ' + f(max);
  }

  function buildHud() {
    drop('hzHud');
    var info = battleInfo();
    var me = overlayInfoMe();
    var foe = overlayInfoFoe();
    var b = (typeof bt !== 'undefined') ? bt : null;

    var hud = mk('div', 'hz-hud');
    hud.id = 'hzHud';

    var left = me
      ? '<div class="hz-hud-side me">' +
          '<div class="hz-hud-ava"><img src="' + esc(cardArt(me.char)) + '" alt=""></div>' +
          '<div class="hz-hud-info">' +
            '<div class="hz-hud-name">' + esc(me.name) + '</div>' +
            '<div class="hz-hud-hp"><i id="hzHpMe"></i></div>' +
          '</div>' +
          '<div class="hz-hud-num"><b id="hzHpMeT">' +
            hpTxt(b ? b.pHp : 0, b ? b.pMax : 0) + '</b><em>HP</em></div>' +
        '</div>'
      : '';

    var right = foe
      ? '<div class="hz-hud-side foe">' +
          '<div class="hz-hud-ava"><img src="' + esc(cardArt(foe.char)) + '" alt=""></div>' +
          '<div class="hz-hud-info">' +
            '<div class="hz-hud-name">' + esc(foe.name) + '</div>' +
            '<div class="hz-hud-hp"><i id="hzHpFoe"></i></div>' +
          '</div>' +
          '<div class="hz-hud-num"><b id="hzHpFoeT">' +
            hpTxt(b && b.eHp != null ? b.eHp : foeMaxHp(), foeMaxHp()) + '</b><em>HP</em></div>' +
        '</div>'
      : '';

    hud.innerHTML =
      left +
      '<div class="hz-hud-card">' +
        '<div class="hz-kick">' + info.kick + '</div>' +
        '<div class="hz-title">' + esc(info.title) + '</div>' +
        '<div class="hz-sub"><span class="hz-dot"></span>' +
          '<span class="hz-phase">' + esc(info.phase) + '</span></div>' +
      '</div>' +
      right;

    document.body.appendChild(hud);
    syncHudHp();
  }

  function syncHudHp() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (!b) return;
    var me = $('hzHpMe'), foe = $('hzHpFoe');
    if (me) me.style.transform = 'scaleX(' + hpPctMe() + ')';
    if (foe) foe.style.transform = 'scaleX(' + hpPctFoe() + ')';
    var meT = $('hzHpMeT'), foeT = $('hzHpFoeT');
    if (meT) meT.textContent = hpTxt(b.pHp, b.pMax);
    syncPartyRail();
    if (foeT) foeT.textContent = hpTxt(b.eHp != null ? b.eHp : foeMaxHp(), foeMaxHp());
  }

  /* ------------------------------------------------- ACTION RAIL (kanan) */
  /* Hanya dua aksi yang benar-benar berfungsi: SPEED (siklus kecepatan yang
     sudah terbuka per level) dan END BATTLE (keluar lewat tombol mesin
     #bfExit). BATTLE LOG + AUTO dihapus sesuai revisi user. */
  function buildActRail() {
    if ($('hzActRail')) return;
    var wrap = mk('div', 'act-rail');
    wrap.id = 'hzActRail';
    wrap.innerHTML =
      '<button id="hzSpeed" type="button"><span>SPEED 1&times;</span></button>' +
      '<button id="hzEnd" class="hz" type="button"><span>END BATTLE</span></button>';
    document.body.appendChild(wrap);

    var sp = $('hzSpeed');
    if (sp) sp.onclick = function () {
      var cur = battleSpeedEff();
      var max = battleSpeedMax();
      if (max <= 1) {
        /* Mesin memang mengunci kecepatan per level; beri tahu pemain
           alih-alih tombol terasa mati. */
        try { toast('SPEED LOCKED', 'Unlocks at LV 10', '#f3e600'); } catch (e) {}
        return;
      }
      var next = cur >= max ? 1 : cur + 1;
      state.battleSpeed = next;
      try { save(); } catch (e) {}
      if (typeof bt !== 'undefined' && bt) bt.speed = battleSpeedEff();
      try { if (window.CyberSfx && window.CyberSfx.katanaSlash) window.CyberSfx.katanaSlash(1.3); } catch (e) {}
      syncActRail();
    };
    var en = $('hzEnd');
    if (en) en.onclick = function () {
      /* Keluar battle lewat banner exit yang sama dengan tombol popup hasil,
         supaya alurnya konsisten (popup dulu, curtain saat benar-benar pindah). */
      if (typeof window.leaveBattleToLobby === 'function') { window.leaveBattleToLobby(); return; }
      var btn = document.getElementById('bfExit');
      if (btn) btn.click();
      else if (typeof window.hzCurtainOut === 'function') {
        window.hzCurtainOut(function () {
          try { stopBattleLoop(); stopRaid(); stopTower(); state.battle = null; } catch (e) {}
          try { render(); } catch (e) {}
        });
      }
    };
  }

  function syncActRail() {
    var b = (typeof bt !== 'undefined') && bt ? bt : null;
    var sp = $('hzSpeed');
    if (!sp) return;
    var spd = b ? (b.speed || 1) : battleSpeedEff();
    var txt = 'SPEED ' + spd + '\u00d7';
    var label = sp.firstChild;
    if (label && label.textContent !== txt) label.textContent = txt;
  }

  /* ------------------------------------------------- PARTY RAIL (1 rail) */
  function cardThumbOf(charId) {
    try { if (charId && typeof cardThumb === 'function') return cardThumb(charId); } catch (e) {}
    try { if (charId && typeof cardImg === 'function') return cardImg(charId); } catch (e) {}
    return '';
  }

  function buildPartyRail() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (!b || !b.fighters || !b.fighters.length) return;
    drop('hzPartyRail');
    var active = b.active || 0;
    var row = '';
    for (var i = 0; i < b.fighters.length && i < 4; i++) {
      var f = b.fighters[i];
      if (!f) continue;
      var dead = (i === active) ? !(b.pHp > 0) : !!(b.revUsed && b.revUsed[i]);
      var pct = 1;
      if (i === active && b.pMax) pct = Math.max(0, Math.min(1, b.pHp / b.pMax));
      row += '<div class="pt' + (i === active ? ' active' : '') + (dead ? ' dead' : '') +
        '" data-i="' + i + '">' +
        '<img src="' + esc(cardThumbOf(f.char)) + '" alt="">' +
        '<span>' + (i + 1) + '</span>' +
        '<i><b style="transform:scaleX(' + (dead ? 0 : pct) + ')"></b></i>' +
        '</div>';
    }
    if (!row) return;
    var wrap = mk('div', 'party');
    wrap.id = 'hzPartyRail';
    wrap.innerHTML = '<div class="party-h">YOUR PARTY</div>' +
      '<div class="party-row">' + row + '</div>';
    document.body.appendChild(wrap);
  }

  function buildPiles() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (!b) return;
    drop('hzPileStrip');
    var wrap = mk('div', 'side-stack');
    wrap.id = 'hzPileStrip';
    wrap.innerHTML = equipStripHtml();
    try {
      var a = (state && Array.isArray(state.artSlots)) ? state.artSlots : [];
      wrap.setAttribute('data-sig', (a[0] || '') + '|' + (a[1] || '') + '|' + ((state && state.petEquipped) || ''));
    } catch (e) {}
    document.body.appendChild(wrap);
  }

  /* Slot perlengkapan pemain: ART 1, ART 2, PET (revisi user 2026-11-08).
     Menggantikan strip DECK/GRAVE/SUPPORT; slot kosong tampil sebagai
     placeholder garis putus-putus supaya posisinya tetap terbaca. */
  function defById(list, id) {
    if (!id) return null;
    try {
      for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    } catch (e) {}
    return null;
  }
  function equipStripHtml() {
    var slots = [];
    try {
      if (typeof state !== 'undefined' && state) {
        var arr = Array.isArray(state.artSlots) ? state.artSlots : [];
        slots.push(arr[0] || null);
        slots.push(arr[1] || null);
        slots.push(state.petEquipped || null);
      }
    } catch (e) {}
    while (slots.length < 3) slots.push(null);
    var arts = (typeof ART_DEFS !== 'undefined') ? ART_DEFS : [];
    var pets = (typeof PET_DEFS !== 'undefined') ? PET_DEFS : [];
    var labels = ['ART 1', 'ART 2', 'PET'];
    var html = '';
    for (var i = 0; i < 3; i++) {
      var id = slots[i];
      var def = i < 2 ? defById(arts, id) : defById(pets, id);
      var img = def ? (def.img || '') : '';
      html += '<div class="eq-slot' + (img ? '' : ' empty') + '">' +
        (img ? '<img src="' + esc(img) + '" alt="">' : '<span class="eq-dot"></span>') +
        '<b>' + labels[i] + '</b></div>';
    }
    return html;
  }

  /* --------------------------------------------------- ENEMY LINE-UP */
  /* Revisi user 2026-11-08: slot party musuh di bawah HUD kanan (prototipe
     .foe-lineup). Sumber: antrean wave tower; story/raid = target tunggal. */
  function foeLineupData() {
    var out = [];
    try {
      if (typeof towerRun !== 'undefined' && towerRun && towerRun.waves && towerRun.waves.length) {
        for (var i = (towerRun.idx || 0); i < towerRun.waves.length && out.length < 4; i++) {
          var w = towerRun.waves[i];
          if (!w || !w.en) continue;
          if (w.dead) continue;
          var maxHp = (w.es && w.es.hp) || 1;
          var hp = (w.hp != null) ? w.hp : maxHp;
          out.push({
            img: w.en.img || '', name: w.en.name || '', num: i + 1,
            pct: Math.max(0, Math.min(1, hp / maxHp))
          });
        }
        if (out.length) return out;
      }
    } catch (e) {}
    var foe = overlayInfoFoe();
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (foe) {
      out.push({
        img: cardArt(foe.char), name: foe.name, num: 1,
        pct: b ? hpPctFoe() : 1
      });
    }
    return out;
  }

  function buildFoeLineup() {
    drop('hzFoeLineup');
    var list = foeLineupData();
    if (!list.length) return;
    /* Tower = antrean wave (slot party musuh). Story/raid cuma satu target,
       jadi HUD kanan sudah mewakilinya — tidak perlu tile duplikat. */
    var isQueue = false;
    try { isQueue = !!(typeof towerRun !== 'undefined' && towerRun && towerRun.waves); } catch (e) {}
    if (!isQueue) return;
    var count = 4;
    var row = '';
    for (var i = 0; i < count; i++) {
      var t = list[i];
      if (t) {
        row += '<div class="tile"><img src="' + esc(t.img) + '" alt="">' +
          '<span>' + t.num + '</span>' +
          '<i style="transform:scaleX(' + t.pct + ')"></i></div>';
      } else {
        row += '<div class="tile empty"><span>' + (i + 1) + '</span></div>';
      }
    }
    var wrap = mk('div', 'hz-foe-lineup');
    wrap.id = 'hzFoeLineup';
    wrap.setAttribute('data-sig', list.map(function (t) { return t.num; }).join(','));
    wrap.innerHTML = '<div class="row">' + row + '</div>' +
      '<div class="cap">ENEMY LINE-UP</div>';
    document.body.appendChild(wrap);
  }

  function syncFoeLineup() {
    var el = $('hzFoeLineup');
    var list = foeLineupData();
    if (!el) { if (list.length) buildFoeLineup(); return; }
    if (!list.length) { drop('hzFoeLineup'); return; }
    /* Signature: nomor + jumlah tile. Perubahan HP cukup update bar, tidak
       rebuild DOM (anti-flicker). */
    var sig = list.map(function (t) { return t.num; }).join(',');
    if (el.getAttribute('data-sig') !== sig) { buildFoeLineup(); return; }
    var bars = el.querySelectorAll('.tile i');
    for (var i = 0; i < bars.length && i < list.length; i++) {
      bars[i].style.transform = 'scaleX(' + list[i].pct + ')';
    }
  }

  function syncPartyRail() {
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (!b) return;
    if (!$('hzPileStrip')) buildPiles();
    var wrap = $('hzPartyRail');
    if (!wrap) { buildPartyRail(); return; }
    var active = b.active || 0;
    var pts = wrap.querySelectorAll('.pt');
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
    var pile = $('hzPileStrip');
    if (pile) {
      /* Strip perlengkapan statis per battle; hanya rebuild kalau isi slot
         berubah (pemain ganti artefak/pet di tengah run). */
      var sig = '';
      try {
        var a = (state && Array.isArray(state.artSlots)) ? state.artSlots : [];
        sig = (a[0] || '') + '|' + (a[1] || '') + '|' + ((state && state.petEquipped) || '');
      } catch (e) {}
      if (pile.getAttribute('data-sig') !== sig) {
        drop('hzPileStrip');
        buildPiles();
        var np = $('hzPileStrip');
        if (np) np.setAttribute('data-sig', sig);
      }
    }
  }

  /* ------------------------------------------------------------ PARTY RAIL */
  

  /* --------------------------------------------------------------- PILES */
  

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
      sub = 'SECTOR ' + String((function () {
        var b = (typeof bt !== 'undefined') ? bt : null;
        return (b && b.lv) || 1;
      })()).padStart(2, '0') + ' - BATTLE GATE';
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
      drop('hzArena'); drop('hzHud'); drop('hzPartyRail'); drop('hzPileStrip');
      drop('hzActRail'); drop('hzFoeLineup');
      return;
    }
    var b = (typeof bt !== 'undefined') ? bt : null;
    if (!b) return;

    if (!$('hzArena')) buildArena();
    if (!$('hzHud')) buildHud();
    else if (!$('hzHpMe')) buildHud();
    else syncHudHp();

    syncPartyRail();
    syncFoeLineup();
    syncActRail();
  }

  function decorate() {
    buildArena();
    buildHud();
    buildPartyRail();
    buildPiles();
    buildActRail();
    buildFoeLineup();
  }

  /* -------------------------------------------------------------- BOOT */
  syncT = setInterval(sync, 400);
  if (syncT && syncT.unref) syncT.unref();

  window.hzBattleDecorate = decorate;
  window.hzBattleSync = sync;
  window.hzCurtainIn = curtainIn;
  window.hzCurtainOut = curtainOut;
})();
