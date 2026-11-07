/* ==========================================================================
   SKILL-TREE.JS — layar "SKILL TREE / SYNAPSE COMMAND" (produksi)
   Port dari _tmp/proto_skilltree_v1.html (prototipe v1, 2026-11-07).

   Layar TERPISAH: modal full-screen sendiri (#skillModal) + banner hazard
   masuk/keluar (#skillCurtain, hidup di body seperti #deckCurtain).

   Sumber data (JANGAN duplikasi rumus / jangan tulis angka sendiri):
     TREE_NODES      js/panels.js  -> id, branch, tier, cost, luck, luckPct, speed, req
     treeOwned(id)   js/panels.js
     treeBuy(id)     js/panels.js  -> satu-satunya jalur tulis (potong SP + save)
     state.player.sp js/state.js

   Bahasa: seluruh teks layar ini English. Nama & deskripsi node di produksi
   masih Indonesia, jadi dipetakan lewat NAME_EN / DESC_EN di bawah. Angka
   (cost / luck / speed / req) TIDAK dipetakan — selalu dari TREE_NODES.

   API publik: window.openSkillTree() / window.closeSkillTree() / window.skillTreeRender()
   ========================================================================== */
(function () {
  'use strict';

  var SK = {
    open: false,
    sel: 'none',        /* 'none' | 'path' | 'node' */
    selId: null,
    path: null,
    web: true,
    zoom: 100,
    viewMode: 'all',
    narrow: false,
    view: { scale: 1, tx: 0, ty: 0 },
    timers: []
  };

  var PATHS = [
    { id: 'luck',    name: 'LUCK',    tag: 'FORTUNE MATRIX',   color: 'var(--p-luck)',  icon: 'luck' },
    { id: 'speed',   name: 'SPEED',   tag: 'TEMPO MATRIX',     color: 'var(--p-speed)', icon: 'speed' },
    { id: 'booster', name: 'BOOSTER', tag: 'RESONANCE MATRIX', color: 'var(--p-boost)', icon: 'booster' }
  ];

  /* nama English (produksi: FONDASI + nama node sudah English) */
  var NAME_EN = { root: 'FOUNDATION' };

  /* deskripsi English per node id */
  var DESC_EN = {
    root:  'Root of the matrix. Every branch flows from here.',
    lk1:   'Sharper eyes for the rare pulls. +5 flat luck.',
    lk2:   'Better odds start to show. +10 flat luck.',
    lk3:   'Fortune begins to flow. +15 flat luck.',
    lk4:   'A harvest of lucky pulls. +20 flat luck.',
    lk5:   'Every stream of fortune converges. +25 flat luck, +10% luck multiplier.',
    sp1:   'Rolls start moving faster. +0.4 roll speed.',
    sp2:   'The gap between rolls shrinks. +0.6 roll speed.',
    sp3:   'Lightning-fast pull cadence. +0.8 roll speed.',
    sp4:   'Barely any wait left. +1.0 roll speed.',
    sp5:   'Speed branch cap (cumulative 5.0x). Potions and weather can push further.',
    bst1:  'First resonance. +50 flat luck, +25% luck multiplier.',
    bst2:  'Second wave of amplification. +50 flat luck, +25% multiplier.',
    bst3:  'Third layer of resonance. +50 flat luck, +25% multiplier.',
    bst4:  'Almost at the peak — luck is boiling. +50 flat luck, +25% multiplier.',
    bst5:  'Peak of the booster branch. +100 flat luck, +50% multiplier.'
  };

  /* Ikon = aset proyek, dipakai lewat CSS mask (warna ikut currentColor). */
  var ICONS = {
    luck:    'assets/icons/clover.svg',
    speed:   'assets/icons/lightning-trio.svg',
    booster: 'assets/icons/sparkles.svg',
    core:    'assets/icons/portal.svg',
    lock:    'assets/icons/padlock.svg'
  };
  function iconStyle(key) {
    var u = 'url(' + ICONS[key] + ')';
    return '-webkit-mask:' + u + ' center/contain no-repeat;mask:' + u + ' center/contain no-repeat;';
  }
  function icon(key, size) {
    return '<span class="sk-ico" style="' + iconStyle(key) + 'width:' + (size || 18) + 'px;height:' + (size || 18) + 'px"></span>';
  }

  /* ---------- geometri panggung (design px) ----------
     Node 60px + ring 4px = 68px visual. Jarak pusat 84px -> celah nyata 16px,
     jadi kolom BOOSTER (lurus vertikal) tidak lagi saling menempel. */
  var WIDE = {
    pos: {
      bst5: [320, 30], bst4: [320, 114], bst3: [320, 198], bst2: [320, 282], bst1: [320, 366],
      lk5: [150, 440], sp5: [490, 440],
      lk4: [176, 508], sp4: [464, 508],
      lk3: [204, 576], sp3: [436, 576],
      lk2: [240, 644], sp2: [400, 644],
      lk1: [278, 712], sp1: [362, 712],
      root: [320, 780]
    },
    med: [320, 876],
    w: 640, h: 940
  };
  var NARROW = {
    pos: {
      bst5: [190, 30], bst4: [190, 108], bst3: [190, 186], bst2: [190, 264], bst1: [190, 342],
      lk5: [84, 420], sp5: [296, 420],
      lk4: [84, 498], sp4: [296, 498],
      lk3: [84, 576], sp3: [296, 576],
      lk2: [84, 654], sp2: [296, 654],
      lk1: [84, 732], sp1: [296, 732],
      root: [190, 810]
    },
    med: [190, 906],
    w: 380, h: 970
  };
  var PAD = 20;

  /* ------------------------------ helpers ------------------------------ */
  function el(id) { return document.getElementById(id); }
  function safe(fn, d) { try { return fn(); } catch (e) { return d; } }
  function hasState() { return typeof state !== 'undefined' && !!state; }
  function allNodes() { return safe(function () { return TREE_NODES; }, []) || []; }
  function nodeById(id) {
    var l = allNodes();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function owned(id) { return safe(function () { return treeOwned(id); }, false); }
  function spNow() { return safe(function () { return (state.player && state.player.sp) || 0; }, 0); }
  function layout() { return SK.narrow ? NARROW : WIDE; }
  function nodePos(id) { var p = layout().pos; return p[id] || null; }
  function medPos() { return layout().med; }

  function pathOf(branch) {
    for (var i = 0; i < PATHS.length; i++) if (PATHS[i].id === branch) return PATHS[i];
    return { id: 'root', name: 'CORE', tag: 'ROOT', color: 'rgba(245,245,245,.7)', icon: 'core' };
  }
  function pathNodes(pid) {
    return allNodes().filter(function (n) { return n.branch === pid; });
  }
  function pathOwned(pid) {
    return pathNodes(pid).filter(function (n) { return owned(n.id); }).length;
  }
  function totalOwned() {
    return allNodes().filter(function (n) { return owned(n.id); }).length;
  }
  function reqMet(n) {
    return (n.req || []).every(function (r) { return r === 'root' || owned(r); });
  }
  function stateOf(n) {
    if (owned(n.id)) return 'owned';
    if (reqMet(n)) return 'avail';
    return 'locked';
  }
  function nameOf(n) { return NAME_EN[n.id] || n.name; }
  function descOf(n) { return DESC_EN[n.id] || ''; }
  function reqText(n) {
    return (n.req || []).map(function (r) {
      var q = nodeById(r);
      return q ? nameOf(q) : r;
    }).join(' + ');
  }
  function statBits(n) {
    var a = [];
    if (n.luck) a.push('+' + n.luck + ' FLAT LUCK');
    if (n.luckPct) a.push('+' + Math.round(n.luckPct * 100) + '% LUCK MULT');
    if (n.speed) a.push('+' + n.speed.toFixed(1) + 'x ROLL SPEED');
    return a.join(' · ') || 'ROOT OF THE MATRIX';
  }

  /* ------------------------------ render ------------------------------- */
  function renderPaths() {
    var host = el('skPaths');
    if (!host) return;
    var h = '';
    PATHS.forEach(function (p) {
      var tot = pathNodes(p.id).length;
      var got = pathOwned(p.id);
      var pct = tot ? Math.round(got / tot * 100) : 0;
      var on = SK.path === p.id;
      h += '<button type="button" class="sk-path' + (on ? ' on' : '') + '" data-path="' + p.id + '" '
        + 'style="--pc:' + p.color + '" aria-pressed="' + on + '" aria-label="' + p.name + ' path, '
        + got + ' of ' + tot + ' learned">'
        + '<span class="sk-path-ic">' + icon(p.icon, 15) + '</span>'
        + '<span class="sk-path-tx">'
        +   '<span class="sk-path-n">' + p.name + '</span>'
        +   '<span class="sk-path-bar"><i style="transform:scaleX(' + (pct / 100) + ')"></i></span>'
        + '</span>'
        + '<span class="sk-path-p">' + got + '/' + tot + '</span>'
        + '</button>';
    });
    host.innerHTML = h;
    Array.prototype.forEach.call(host.querySelectorAll('[data-path]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-path');
        SK.path = (SK.path === id) ? null : id;
        SK.sel = SK.path ? 'path' : 'none';
        SK.selId = SK.path;
        SK.viewMode = SK.path ? 'path' : 'all';
        /* TIDAK renderPaths() di sini: me-rebuild daftar saat tombol sedang
           diklik membuat elemen hilang sebelum sentuhan selesai (di WebView
           chip terasa mati). Cukup sinkronkan kelas + isi panel lain. */
        syncPathChips();
        syncTreeAndDetail();
        setView(true);
      });
    });
    syncPathChips();
  }

  /* update kelas aktif pada chip yang SUDAH ada (tanpa rebuild) */
  function syncPathChips() {
    var host = el('skPaths');
    if (!host) return;
    Array.prototype.forEach.call(host.querySelectorAll('[data-path]'), function (b) {
      var on = SK.path === b.getAttribute('data-path');
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var tag = el('skPathTag');
    if (tag) tag.textContent = PATHS.length + ' / ' + PATHS.length;
  }

  /* render ulang tree + panel kanan (dipakai setelah memilih path/node) */
  function syncTreeAndDetail() {
    var status = el('skStatus');
    if (status) {
      var n = (SK.sel === 'node') ? nodeById(SK.selId) : null;
      status.textContent = n ? ('TALENT · ' + nameOf(n))
        : (SK.sel === 'path' && SK.path ? ('PATH · ' + pathOf(SK.path).name) : 'SELECT A PATH OR TALENT');
    }
    var st = el('skStage');
    if (st) st.classList.toggle('noweb', !SK.web);
    renderEdges(); renderNodes(); renderDetail();
    var fa = el('skFootAll');
    if (fa) fa.classList.toggle('on', !SK.path);
  }

  function renderEdges() {
    var svg = el('skEdges');
    if (!svg) return;
    var h = '';
    allNodes().forEach(function (n) {
      if (!n.req || !n.req.length) return;
      var to = nodePos(n.id);
      if (!to) return;
      n.req.forEach(function (r) {
        var from = nodePos(r);
        if (!from) return;
        var cls = 'sk-edge';
        if (owned(r) && owned(n.id)) cls += ' on';
        else if (owned(r) && !owned(n.id)) cls += ' live';
        var geom = 'x1="' + from[0] + '" y1="' + from[1] + '" x2="' + to[0] + '" y2="' + to[1] + '"';
        /* kanal gelap di bawah garis: garis path tidak lagi "tembus pandang"
           di atas starfield, dan node tetap jadi titik fokus. */
        h += '<line class="sk-edge-chan" ' + geom + '/>';
        h += '<line class="' + cls + '" ' + geom + '/>';
      });
    });
    svg.innerHTML = h;
  }

  function renderNodes() {
    var host = el('skNodes');
    if (!host) return;
    var h = '';
    allNodes().forEach(function (n) {
      if (n.id === 'root') return;
      var p = nodePos(n.id);
      if (!p) return;
      var st = stateOf(n);
      var cls = 'sk-node ' + st;
      if (SK.sel === 'node' && SK.selId === n.id) cls += ' sel';
      if (SK.path && n.branch !== SK.path) cls += ' dim';
      var pth = pathOf(n.branch);
      h += '<button type="button" class="' + cls + '" data-node="' + n.id + '" '
        + 'style="--nc:' + pth.color + ';left:' + p[0] + 'px;top:' + p[1] + 'px" '
        + 'aria-label="' + nameOf(n) + ' — ' + st + '">'
        + icon(pth.icon, 22)
        + '<span class="sk-node-t"><b>' + (n.tier || 0) + '</b></span>'
        + '<span class="sk-node-lb">' + nameOf(n) + '</span>'
        + '</button>';
    });
    host.innerHTML = h;
    Array.prototype.forEach.call(host.querySelectorAll('[data-node]'), function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        SK.sel = 'node';
        SK.selId = b.getAttribute('data-node');
        var n = nodeById(SK.selId);
        if (n && n.branch !== 'root') SK.path = n.branch;
        syncPathChips();
        syncTreeAndDetail();
        focusNode(SK.selId);
      });
    });
  }

  function renderDetail() {
    var host = el('skDetail');
    if (!host) return;
    var n = (SK.sel === 'node') ? nodeById(SK.selId) : null;
    if (n) { host.innerHTML = nodeDetailHtml(n); bindDetail(); return; }
    if (SK.sel === 'path' && SK.path) { host.innerHTML = pathDetailHtml(pathOf(SK.path)); bindDetail(); return; }
    host.innerHTML = '<div class="sk-dempty">'
      + '<span class="ic">' + icon('core', 40) + '</span>'
      + '<b>SELECT A TALENT</b>'
      + '<span>CLICK ANY NODE IN THE MATRIX TO INSPECT IT</span>'
      + '</div>';
  }

  function nodeDetailHtml(n) {
    var st = stateOf(n);
    var pth = pathOf(n.branch);
    var col = pth.color;
    var sp = spNow();
    var isRoot = n.branch === 'root';
    var tot = isRoot ? 0 : pathNodes(n.branch).length;
    var got = isRoot ? 0 : pathOwned(n.branch);
    var pct = tot ? Math.round(got / tot * 100) : 100;
    var can = st === 'avail' && sp >= n.cost;

    var stateLbl = st === 'owned' ? 'LEARNED'
      : (st === 'avail' ? 'AVAILABLE — ' + n.cost + ' SP'
        : 'LOCKED — REQUIRES ' + reqText(n));

    var stats = '';
    if (n.luck) stats += '<div class="sk-dstat hot"><k>FLAT LUCK</k><v>+' + n.luck + '</v></div>';
    if (n.luckPct) stats += '<div class="sk-dstat mut"><k>LUCK MULT</k><v>+' + Math.round(n.luckPct * 100) + '%</v></div>';
    if (n.speed) stats += '<div class="sk-dstat mut"><k>ROLL SPEED</k><v>+' + n.speed.toFixed(1) + 'x</v></div>';
    stats += '<div class="sk-dstat' + (st === 'avail' ? ' hot' : '') + '"><k>SP COST</k><v>' + n.cost + '</v></div>';

    var btn = st === 'owned' ? 'LEARNED'
      : st === 'locked' ? 'LOCKED'
      : can ? 'LEARN TALENT — ' + n.cost + ' SP'
      : 'NEED ' + n.cost + ' SP · HAVE ' + sp;

    var progress = isRoot ? '' :
      '<div class="sk-dpath" style="--pc:' + col + '">'
      + '<div class="sk-dpath-h"><b>' + pth.name + '</b><span class="rule"></span><span>PATH PROGRESS</span></div>'
      + '<div class="sk-dpath-bar"><i style="transform:scaleX(' + (pct / 100) + ')"></i></div>'
      + '<div class="sk-dpath-n"><span>LEARNED <b>' + got + ' / ' + tot + '</b></span><span>' + pct + '%</span></div>'
      + '</div>';

    return '<div class="sk-dhero" style="--dc:' + col + '">'
      + '<div class="sk-dicon">' + icon(pth.icon, 38) + '</div>'
      + '<div class="sk-dhd">'
      +   '<div class="sk-dname">' + nameOf(n) + '</div>'
      +   '<div class="sk-dbadges"><span class="sk-db">' + pth.name + '</span>'
      +     '<span class="sk-db plain">TIER ' + (n.tier || 0) + '</span></div>'
      +   '<div class="sk-dstate ' + (st === 'locked' ? 'locked' : '') + '">' + stateLbl + '</div>'
      + '</div>'
      + '</div>'
      + '<div class="sk-ddesc">' + descOf(n) + '</div>'
      + '<div class="sk-dstats">' + stats + '</div>'
      + progress
      + '<div class="sk-dfoot">'
      +   '<button class="sk-learn" id="skBtnLearn"' + (can ? '' : ' disabled') + '>' + btn + '</button>'
      +   '<div class="sk-dnote">SKILL POINTS AVAILABLE: <b>' + sp + '</b></div>'
      + '</div>';
  }

  function pathDetailHtml(p) {
    var list = pathNodes(p.id);
    var tot = list.length;
    var got = pathOwned(p.id);
    var pct = tot ? Math.round(got / tot * 100) : 0;
    var spent = 0, left = 0;
    list.forEach(function (n) { if (owned(n.id)) spent += n.cost; else left += n.cost; });
    var next = list.filter(function (n) { return !owned(n.id) && reqMet(n); })[0];
    var sp = spNow();
    var desc = p.id === 'luck' ? 'Flat luck on every pull, closed out with a luck multiplier at tier 5.'
      : p.id === 'speed' ? 'Shortens the gap between rolls. Stacks with potions and weather.'
      : 'Unlocks once both branches reach tier 5. Raw luck amplification.';

    return '<div class="sk-dhero" style="--dc:' + p.color + '">'
      + '<div class="sk-dicon">' + icon(p.icon, 38) + '</div>'
      + '<div class="sk-dhd">'
      +   '<div class="sk-dname">' + p.name + '</div>'
      +   '<div class="sk-dbadges"><span class="sk-db">PATH</span>'
      +     '<span class="sk-db plain">' + tot + ' TALENTS</span></div>'
      +   '<div class="sk-dstate">' + (got === tot ? 'COMPLETE' : 'IN PROGRESS') + '</div>'
      + '</div>'
      + '</div>'
      + '<div class="sk-ddesc">' + desc + '</div>'
      + '<div class="sk-dlore">' + p.tag + ' · EVERY TALENT UNLOCKS THE NEXT IN ITS CHAIN.</div>'
      + '<div class="sk-dstats">'
      +   '<div class="sk-dstat hot"><k>LEARNED</k><v>' + got + ' / ' + tot + '</v></div>'
      +   '<div class="sk-dstat"><k>SP SPENT</k><v>' + spent + '</v></div>'
      +   '<div class="sk-dstat"><k>SP REMAINING</k><v>' + left + '</v></div>'
      +   '<div class="sk-dstat"><k>COMPLETE</k><v>' + pct + '%</v></div>'
      + '</div>'
      + '<div class="sk-dpath" style="--pc:' + p.color + '">'
      +   '<div class="sk-dpath-h"><b>' + p.name + '</b><span class="rule"></span><span>PATH PROGRESS</span></div>'
      +   '<div class="sk-dpath-bar"><i style="transform:scaleX(' + (pct / 100) + ')"></i></div>'
      +   '<div class="sk-dpath-n"><span>NEXT: <b>' + (next ? nameOf(next) : '—') + '</b></span><span>' + pct + '%</span></div>'
      + '</div>'
      + '<div class="sk-dfoot">'
      +   '<button class="sk-learn" id="skBtnLearnPath"' + (next && sp >= next.cost ? '' : ' disabled') + '>'
      +     (next ? 'LEARN NEXT — ' + next.cost + ' SP' : 'PATH COMPLETE')
      +   '</button>'
      +   '<div class="sk-dnote">SKILL POINTS AVAILABLE: <b>' + sp + '</b></div>'
      + '</div>';
  }

  function bindDetail() {
    var b = el('skBtnLearn');
    if (b) b.addEventListener('click', function () { learn(SK.selId); });
    var bp = el('skBtnLearnPath');
    if (bp) bp.addEventListener('click', function () {
      var next = pathNodes(SK.path).filter(function (n) { return !owned(n.id) && reqMet(n); })[0];
      if (next) learn(next.id);
    });
  }

  /* ------------------------------ actions ------------------------------ */
  function learn(id) {
    var n = nodeById(id);
    if (!n) return;
    if (owned(id)) { toast('ALREADY LEARNED'); return; }
    if (!reqMet(n)) { toast('LOCKED — LEARN THE PARENT TALENT FIRST'); return; }
    if (spNow() < n.cost) { toast('NOT ENOUGH SKILL POINTS'); return; }

    var r = safe(function () { return treeBuy(id); }, null);
    if (!r || !r.ok) {
      toast(r && r.reason === 'SP' ? 'NOT ENOUGH SKILL POINTS' : 'CANNOT LEARN THIS TALENT');
      return;
    }
    SK.sel = 'node';
    SK.selId = id;
    if (n.branch !== 'root') SK.path = n.branch;
    safe(function () { if (window.sfx && sfx.hit) sfx.hit(); });
    renderAll();
    toast('LEARNED ' + nameOf(n) + ' — ' + n.cost + ' SP SPENT');
    safe(function () { if (typeof renderShell === 'function') renderShell(); });
  }

  function learnAll() {
    var did = 0;
    for (var guard = 0; guard < 40; guard++) {
      var cand = allNodes().filter(function (n) {
        return n.id !== 'root' && !owned(n.id) && reqMet(n) && n.cost <= spNow();
      }).sort(function (a, b) { return a.cost - b.cost; })[0];
      if (!cand) break;
      var r = safe(function () { return treeBuy(cand.id); }, null);
      if (!r || !r.ok) break;
      did++;
    }
    renderAll();
    toast(did ? ('LEARNED ' + did + ' TALENT' + (did > 1 ? 'S' : '') + ' AUTOMATICALLY')
              : 'NOTHING AFFORDABLE RIGHT NOW');
    if (did) safe(function () { if (typeof renderShell === 'function') renderShell(); });
  }

  /* Produksi tidak menyimpan riwayat beli, jadi refund tidak mungkin tanpa
     mengubah state/panel. Tombol tetap ada supaya pemain tahu aturannya. */
  function resetInfo() {
    toast('SKILL POINTS ARE PERMANENT — NO RESET AVAILABLE');
  }

  /* --------------------------- view / pan / zoom ------------------------ */
  function applyView() {
    var st = el('skStage');
    if (!st) return;
    st.style.transform = 'translate(' + SK.view.tx.toFixed(1) + 'px,' + SK.view.ty.toFixed(1) + 'px)'
      + ' scale(' + SK.view.scale.toFixed(4) + ')';
  }

  function syncNarrow(cw) {
    var next = cw < 620;
    if (next === SK.narrow) return;
    SK.narrow = next;
    var st = el('skStage'), sg = el('skEdges'), L = layout();
    if (st) { st.style.width = L.w + 'px'; st.style.height = L.h + 'px'; }
    if (sg) {
      sg.setAttribute('width', L.w);
      sg.setAttribute('height', L.h);
      sg.setAttribute('viewBox', '0 0 ' + L.w + ' ' + L.h);
    }
    var core = document.querySelector('#skillModal .sk-core');
    var mc = medPos();
    if (core) { core.style.left = mc[0] + 'px'; core.style.top = mc[1] + 'px'; }
    renderEdges(); renderNodes();
  }

  function boxOf(ids) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    ids.forEach(function (id) {
      var p = (id === '__med') ? medPos() : nodePos(id);
      if (!p) return;
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    });
    var L = layout();
    if (x0 > x1) return [0, 0, L.w, L.h];
    var pad = 56;
    /* atas lebih lega: badge tier duduk di atas node (top:-4px + 18px) */
    return [x0 - pad, y0 - pad - 40, x1 + pad, y1 + pad + 34];
  }

  function boxForMode() {
    if (SK.viewMode === 'path' && SK.path) {
      var ids = ['__med'];
      allNodes().forEach(function (n) {
        if (n.branch === SK.path || n.id === 'root') ids.push(n.id);
      });
      return boxOf(ids);
    }
    var all = ['__med'];
    allNodes().forEach(function (n) { if (nodePos(n.id)) all.push(n.id); });
    return boxOf(all);
  }

  function focusTarget() {
    if (SK.sel === 'node' && nodePos(SK.selId)) return SK.selId;
    var next = allNodes().filter(function (n) {
      return n.id !== 'root' && !owned(n.id) && reqMet(n);
    })[0];
    return next ? next.id : 'root';
  }

  function setView(animate, centerDesign) {
    var wrap = el('skStageWrap');
    if (!wrap) return;
    var cw = wrap.clientWidth, ch = wrap.clientHeight;
    syncNarrow(cw);
    var b = boxForMode();
    var bw = Math.max(1, b[2] - b[0]), bh = Math.max(1, b[3] - b[1]);
    var fit = Math.min((cw - PAD * 2) / bw, (ch - PAD * 2) / bh);
    if (!isFinite(fit) || fit <= 0) fit = 1;

    var c;
    if (SK.narrow) {
      var MINN = 0.78;
      if (fit >= MINN) {
        fit = Math.min(1.15, fit);
        c = centerDesign || [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
      } else {
        fit = MINN;
        c = centerDesign || nodePos(focusTarget()) || medPos();
      }
    } else {
      fit = Math.max(0.70, Math.min(1.9, fit));
      c = centerDesign || [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    }

    SK.view.scale = fit * (SK.zoom / 100);
    SK.view.tx = cw / 2 - c[0] * SK.view.scale;
    SK.view.ty = ch / 2 - c[1] * SK.view.scale;

    var hint = el('skPanHint');
    if (hint) {
      var over = (bw * SK.view.scale > cw - 2) || (bh * SK.view.scale > ch - 2);
      hint.classList.toggle('on', over);
      hint.classList.remove('fade');
    }
    if (animate) {
      var st = el('skStage');
      if (st) {
        st.classList.add('anim');
        setTimeout(function () { st.classList.remove('anim'); }, 460);
      }
    }
    applyView();
  }

  function focusNode(id) {
    var p = nodePos(id);
    if (!p) return;
    var wrap = el('skStageWrap');
    if (!wrap) return;
    var cw = wrap.clientWidth, ch = wrap.clientHeight;
    var sx = (cw / 2 - SK.view.tx) / SK.view.scale;
    var sy = (ch / 2 - SK.view.ty) / SK.view.scale;
    var mx = cw / (2 * SK.view.scale) * 0.5, my = ch / (2 * SK.view.scale) * 0.5;
    if (Math.abs(p[0] - sx) > mx || Math.abs(p[1] - sy) > my) setView(true, [p[0], p[1]]);
  }

  function setZoom(pct) {
    SK.zoom = Math.max(60, Math.min(180, Math.round(pct)));
    var z = el('skZoom'); if (z) z.value = SK.zoom;
    var zv = el('skZVal'); if (zv) zv.textContent = SK.zoom + '%';
    var wrap = el('skStageWrap');
    if (!wrap) return;
    var cx = (wrap.clientWidth / 2 - SK.view.tx) / SK.view.scale;
    var cy = (wrap.clientHeight / 2 - SK.view.ty) / SK.view.scale;
    setView(false, [cx, cy]);
  }

  /* ------------------------------ render all --------------------------- */
  function renderAll() {
    var spv = el('skSpVal'); if (spv) spv.textContent = spNow();
    var coreSub = el('skCoreSub');
    if (coreSub) coreSub.textContent = 'LEARNED ' + totalOwned() + ' / ' + allNodes().length;

    var status = el('skStatus');
    if (status) {
      var n = (SK.sel === 'node') ? nodeById(SK.selId) : null;
      status.textContent = n ? ('TALENT · ' + nameOf(n))
        : (SK.sel === 'path' && SK.path ? ('PATH · ' + pathOf(SK.path).name) : 'SELECT A PATH OR TALENT');
    }

    var st = el('skStage');
    if (st) st.classList.toggle('noweb', !SK.web);
    renderPaths(); renderEdges(); renderNodes(); renderDetail();

    var fw = el('skFootWeb'); if (fw) fw.classList.toggle('on', SK.web);
    var fa = el('skFootAll'); if (fa) fa.classList.toggle('on', !SK.path);
    var wl = el('skWebLbl');
    if (wl) wl.textContent = 'WEB VIEW: ' + (SK.web ? 'ON' : 'OFF') + ' [V]';
  }

  /* ------------------------------- toast ------------------------------- */
  var toastT = null;
  function toast(msg) {
    var t = el('skillToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 1800);
  }

  /* ---------------------------- hazard banner -------------------------- */
  function clearTimers() {
    SK.timers.forEach(clearTimeout);
    SK.timers = [];
  }
  function setCopy(mode) {
    var kick = el('skHzKick'), title = el('skHzTitle'), sub = el('skHzSub'),
        foot = el('skHzFoot'), serial = el('skHzSerial'), water = el('skHzWater');
    if (mode === 'open') {
      if (kick) kick.innerHTML = '// NEURAL <b>UPLINK</b>';
      if (title) title.textContent = 'SKILL TREE';
      if (water) water.textContent = 'SYNAPSE';
      if (sub) sub.textContent = 'TALENT MATRIX — ' + allNodes().length + ' NODES / ' + PATHS.length + ' PATHS';
      if (foot) foot.textContent = 'SYNC SYNAPSE';
      if (serial) serial.textContent = '7B14';
    } else {
      if (kick) kick.innerHTML = '// LINK <b>STAND BY</b>';
      if (title) title.textContent = 'HOLD';
      if (water) water.textContent = 'OUT';
      if (sub) sub.textContent = 'SYNAPSE DISCONNECTING — PROGRESS SAVED';
      if (foot) foot.textContent = 'CLOSE SESSION';
      if (serial) serial.textContent = '3D07';
    }
  }

  function bannerOpen() {
    var c = el('skillCurtain');
    if (!c) return;
    clearTimers();
    setCopy('open');
    c.className = '';
    void c.offsetWidth;
    c.classList.add('on', 'smooth', 'sweep');
    SK.timers.push(setTimeout(function () { c.classList.add('revealed'); }, 1060));
    SK.timers.push(setTimeout(function () {
      c.classList.remove('on', 'smooth', 'sweep', 'revealed');
    }, 1780));
  }

  /* EXIT = 3 fase: (1) tirai MENUTUP, (2) konten disembunyikan, (3) tirai MEMBUKA. */
  function bannerClose(onCovered) {
    var c = el('skillCurtain');
    if (!c) { if (onCovered) onCovered(); return; }
    clearTimers();
    setCopy('close');
    c.className = '';
    c.classList.add('on', 'smooth', 'revealed');
    void c.offsetWidth;
    c.classList.remove('revealed');
    SK.timers.push(setTimeout(function () { if (onCovered) onCovered(); }, 520));
    SK.timers.push(setTimeout(function () { c.classList.add('revealed'); }, 740));
    SK.timers.push(setTimeout(function () {
      c.classList.remove('on', 'smooth', 'revealed');
    }, 1560));
  }

  /* ------------------------------ open/close --------------------------- */
  function openSkillTree() {
    var m = el('skillModal');
    if (!m || SK.open) return;
    SK.open = true;
    /* drawer z-index 100000 > modal 94500: tutup dulu supaya tidak menutupi layar */
    safe(function () { if (typeof closeCommandDrawer === 'function') closeCommandDrawer(); });
    safe(function () { if (typeof cgGameplayStart === 'function') cgGameplayStart(); });
    safe(function () { if (window.sfx && sfx.hit) sfx.hit(); });

    SK.path = null; SK.sel = 'none'; SK.selId = null;
    SK.zoom = 100; SK.viewMode = 'all'; SK.web = true;
    var z = el('skZoom'); if (z) z.value = 100;
    var zv = el('skZVal'); if (zv) zv.textContent = '100%';

    m.classList.add('show');
    document.body.classList.add('sk-open');
    renderAll();
    setView(false);
    m.classList.remove('in');
    setTimeout(function () { m.classList.add('in'); }, 1020);
    bannerOpen();
  }

  function closeSkillTree() {
    var m = el('skillModal');
    if (!m || !SK.open) return;
    SK.open = false;
    safe(function () { if (typeof cgGameplayStop === 'function') cgGameplayStop(); });
    var hide = function () {
      m.classList.remove('show', 'in');
      document.body.classList.remove('sk-open');
      if (typeof render === 'function') safe(render);
    };
    bannerClose(hide);
  }

  /* ------------------------------- wiring ------------------------------ */
  function toggleWeb() {
    SK.web = !SK.web;
    renderAll();
  }

  function bind() {
    var m = el('skillModal');
    if (!m || m.__skBound) return;
    m.__skBound = true;

    var x = el('skClose');
    if (x) x.addEventListener('click', function () { closeSkillTree(); });

    var all = el('skBtnLearnAll');
    if (all) all.addEventListener('click', learnAll);
    var rst = el('skBtnReset');
    if (rst) rst.addEventListener('click', resetInfo);
    var ctr = el('skBtnCenter');
    if (ctr) ctr.addEventListener('click', function () { setView(true); });
    var web = el('skBtnWeb');
    if (web) web.addEventListener('click', toggleWeb);
    var fw = el('skFootWeb');
    if (fw) fw.addEventListener('click', toggleWeb);
    var fa = el('skFootAll');
    if (fa) fa.addEventListener('click', function () {
      SK.path = null; SK.viewMode = 'all'; SK.sel = 'none'; SK.selId = null;
      renderAll(); setView(true);
    });
    var zi = el('skZoomIn');
    if (zi) zi.addEventListener('click', function () { setZoom(SK.zoom + 10); });
    var zo = el('skZoomOut');
    if (zo) zo.addEventListener('click', function () { setZoom(SK.zoom - 10); });
    var zr = el('skZoom');
    if (zr) zr.addEventListener('input', function (e) { setZoom(+e.target.value); });

    /* drag-to-pan (pointer events, tanpa rAF loop)
       PENTING: pointer capture BARU dipasang setelah gerakan melewati ambang.
       Kalau capture dipasang saat pointerdown, event 'click' milik node
       dialihkan ke stage-wrap sehingga tombol node tidak pernah terpicu. */
    var wrap = el('skStageWrap');
    if (wrap) {
      var drag = null;
      wrap.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        drag = { x: e.clientX, y: e.clientY, tx: SK.view.tx, ty: SK.view.ty, moved: false, pid: e.pointerId };
      });
      wrap.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved) {
          if (Math.abs(dx) + Math.abs(dy) <= 8) return;
          drag.moved = true;
          wrap.classList.add('drag');
          try { wrap.setPointerCapture(drag.pid); } catch (err) {}
          var ph = el('skPanHint');
          if (ph) ph.classList.add('fade');
        }
        SK.view.tx = drag.tx + dx;
        SK.view.ty = drag.ty + dy;
        applyView();
      });
      var end = function (e) {
        if (!drag) return;
        var pid = drag.pid;
        drag = null;
        wrap.classList.remove('drag');
        try { wrap.releasePointerCapture(pid); } catch (err) {}
      };
      wrap.addEventListener('pointerup', end);
      wrap.addEventListener('pointercancel', end);
      wrap.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaY) < 1) return;
        e.preventDefault();
        setZoom(SK.zoom + (e.deltaY < 0 ? 8 : -8));
      }, { passive: false });
    }

    document.addEventListener('keydown', function (ev) {
      if (!SK.open || ev.key !== 'Escape') return;
      closeSkillTree();
    });

    window.addEventListener('resize', function () {
      if (SK.open) setView(false);
    });
  }

  window.openSkillTree = openSkillTree;
  window.closeSkillTree = closeSkillTree;
  window.skillTreeRender = function () { if (SK.open) renderAll(); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
