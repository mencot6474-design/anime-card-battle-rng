/* ==========================================================================
   DECK-MODAL.JS — layar DECK "SQUADRON COMMAND" (produksi)
   Port dari _tmp/proto_deck_v1.html (desain dikunci user 2026-11-07).

   Layar TERPISAH dari Backpack: modal full-screen sendiri (#deckModal)
   + banner hazard masuk/keluar (#deckCurtain, hidup di body seperti #storyCurtain).

   Sumber data (jangan duplikasi rumus):
     state.stacks        -> koleksi kartu  { id, char, mut, shiny, trait, fav }
     state.deck[4]       -> slot dek aktif (stack id)
     state.artSlots[2]   -> artefak terpasang
     state.petEquipped   -> pet terpasang
     setDeckSlot()/save()-> satu-satunya jalur tulis dek (js/state.js)

   API publik: window.openDeckModal() / window.closeDeckModal() / window.deckModalRender()
   ========================================================================== */
(function () {
  'use strict';

  var DKM = {
    rtab: 'cards',
    q: '',
    inDeckOnly: false,
    sortMode: 'power',
    mutFilter: 'all',
    cardId: null,
    slotFor: null,
    timers: []
  };
  var _open = false;

  /* ------------------------------ helpers ------------------------------ */
  function el(id) { return document.getElementById(id); }
  function safe(fn, dflt) { try { return fn(); } catch (e) { return dflt; } }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function hasState() { return typeof state !== 'undefined' && !!state; }
  function stacks() { return hasState() && Array.isArray(state.stacks) ? state.stacks : []; }
  function deckArr() {
    if (!hasState()) return [null, null, null, null];
    if (!Array.isArray(state.deck)) state.deck = [null, null, null, null];
    while (state.deck.length < 4) state.deck.push(null);
    if (state.deck.length > 4) state.deck.length = 4;
    return state.deck;
  }
  function stackById(id) {
    if (!id) return null;
    var list = stacks();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function powerOf(s) {
    return safe(function () { return bpPowerOf(s); }, 0);
  }
  function statOf(s) {
    return safe(function () { return cardStats(s.char, s.mut, s.trait, s.shiny); }, { hp: 0, atk: 0 });
  }
  function chanceOf(s) {
    return safe(function () { return luckChance(s.char, s.mut, s.shiny); }, 0);
  }
  function mutKey(s) { return (s && s.mut && s.mut !== 'none') ? s.mut : ''; }
  function mutColor(s) {
    var m = mutKey(s);
    if (m && typeof MUT_COLOR !== 'undefined' && MUT_COLOR[m]) return MUT_COLOR[m];
    if (s && s.shiny) return '#7DF9FF';
    return 'rgba(245,245,245,.20)';
  }
  function mutLabel(s) {
    var m = mutKey(s);
    var base = m ? safe(function () { return MUT_LABEL[m]; }, m) : 'STANDARD';
    base = String(base || (m || 'STANDARD')).toUpperCase();
    if (s && s.shiny) base += (m ? ' · SHINY' : '');
    else if (!m) base = 'STANDARD';
    return base;
  }
  function nameOf(s) { return safe(function () { return cardName(s.char); }, s.char); }
  function thumbOf(s) { return safe(function () { return cardThumb(s.char); }, ''); }
  function fmtStatSafe(n) { return safe(function () { return fmtStat(n); }, String(Math.round(n || 0))); }
  function fmtSafe(n) { return safe(function () { return fmt(n); }, String(n || 0)); }
  function chanceText(s) {
    var c = Math.round(chanceOf(s));
    if (!c || c <= 0) return '—';
    return '1 in ' + fmtSafe(c);
  }

  /* ------------------------- support (artefak/pet) --------------------- */
  function supportSlotInfo() {
    var out = [];
    var arts = (hasState() && Array.isArray(state.artSlots)) ? state.artSlots : [];
    for (var i = 0; i < 2; i++) {
      var id = arts[i] || null;
      var def = null;
      if (id && typeof ART_DEFS !== 'undefined') {
        for (var a = 0; a < ART_DEFS.length; a++) if (ART_DEFS[a].id === id) { def = ART_DEFS[a]; break; }
      }
      out.push({ kind: 'art', def: def, idx: i });
    }
    var pid = (hasState() && state.petEquipped) || null;
    var pdef = null;
    if (pid && typeof PET_DEFS !== 'undefined') {
      for (var p = 0; p < PET_DEFS.length; p++) if (PET_DEFS[p].id === pid) { pdef = PET_DEFS[p]; break; }
    }
    out.push({ kind: 'pet', def: pdef, idx: 2 });
    return out;
  }
  function luckText(d) {
    var a = [];
    if (d.flat) a.push('+' + d.flat + ' FLAT');
    if (d.pct) a.push('+' + d.pct + '%');
    return (a.join(' · ') || 'NO BONUS') + ' LUCK';
  }
  function supportPool() {
    var out = [];
    var artOwned = (hasState() && Array.isArray(state.artOwned)) ? state.artOwned : [];
    var petOwned = (hasState() && Array.isArray(state.petOwned)) ? state.petOwned : [];
    if (typeof ART_DEFS !== 'undefined') {
      for (var i = 0; i < ART_DEFS.length; i++) {
        if (artOwned.indexOf(ART_DEFS[i].id) >= 0) out.push({ kind: 'art', def: ART_DEFS[i] });
      }
    }
    if (typeof PET_DEFS !== 'undefined') {
      for (var p = 0; p < PET_DEFS.length; p++) {
        if (petOwned.indexOf(PET_DEFS[p].id) >= 0) out.push({ kind: 'pet', def: PET_DEFS[p] });
      }
    }
    return out;
  }
  function isSupportEquipped(it) {
    if (!hasState()) return false;
    if (it.kind === 'pet') return state.petEquipped === it.def.id;
    return Array.isArray(state.artSlots) && state.artSlots.indexOf(it.def.id) >= 0;
  }
  function supportImg(def) {
    return safe(function () { return thumbSrc(def.img); }, def.img || '');
  }
  function toggleSupport(kind, id) {
    if (!hasState()) return;
    if (kind === 'pet') {
      state.petEquipped = (state.petEquipped === id) ? null : id;
    } else {
      if (!Array.isArray(state.artSlots)) state.artSlots = [null, null];
      while (state.artSlots.length < 2) state.artSlots.push(null);
      var at = state.artSlots.indexOf(id);
      if (at >= 0) state.artSlots[at] = null;
      else {
        var slot = state.artSlots.indexOf(null);
        if (slot < 0) slot = 0;
        state.artSlots[slot] = id;
      }
    }
    afterWrite();
  }

  /* ------------------------------- icons ------------------------------- */
  var ICON_PLUS = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>';
  var ICON_X = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>';
  var ICON_ART = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
  var ICON_PET = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="8" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="5" cy="14" r="2"/><circle cx="19" cy="14" r="2"/><path d="M8 18c1.5 2 6.5 2 8 0"/></svg>';
  var ICON_STAR = '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>';
  var ICON_STAR_O = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" width="13" height="13"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>';
  var ICON_EQUIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/></svg>';
  var ICON_BOLT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg>';

  /* ------------------------------- render ------------------------------ */
  function renderSlots() {
    var wrap = el('dkSlotWrap');
    if (!wrap) return;
    var d = deckArr();
    var out = '';
    for (var i = 0; i < 4; i++) {
      var s = stackById(d[i]);
      if (!s) {
        out += '<div class="dk-slot empty" data-slot="' + i + '" role="button" tabindex="0" aria-label="Slot ' + (i + 1) + ' empty">'
          + '<span class="dk-slot-no">0' + (i + 1) + '</span>'
          + '<span class="plus">' + ICON_PLUS + '</span>'
          + '</div>';
        continue;
      }
      var st = statOf(s);
      var col = mutColor(s);
      var mk = mutKey(s);
      var hzCls = (typeof hzBorderCls === 'function') ? hzBorderCls(mk || 'none', !!s.shiny, { tile: true }) : '';
      var hzLayers = (typeof hzBorderLayerHtml === 'function') ? hzBorderLayerHtml() : '';
      var slotStamps = '';
      if (s.shiny && typeof shinyStampHtml === 'function') slotStamps += shinyStampHtml(true);
      if (mk && typeof mutStampHtml === 'function') slotStamps += mutStampHtml(mk, true);
      if (s.trait && s.trait !== 'none' && typeof traitStampHtml === 'function') slotStamps += traitStampHtml(s.trait, true);
      out += '<div class="dk-slot filled' + hzCls + '" data-slot="' + i + '" role="button" tabindex="0" style="--dk-mc:' + col + '" aria-label="Slot ' + (i + 1) + ': ' + esc(nameOf(s)) + '">'
        + hzLayers
        + '<span class="dk-slot-no">0' + (i + 1) + '</span>'
        + (slotStamps ? '<span class="dk-slot-stamps">' + slotStamps + '</span>' : '')
        + '<div class="dk-slot-art"><img src="' + esc(thumbOf(s)) + '" alt="' + esc(nameOf(s)) + '" width="96" height="96" decoding="async" onerror="this.onerror=null;this.src=\'assets/images/icon-index-card.webp\'"></div>'
        + '<button class="dk-slot-x" data-clear="' + i + '" aria-label="Remove card from slot ' + (i + 1) + '">' + ICON_X + '</button>'
        + '<div class="dk-slot-foot">'
        + '<div class="dk-slot-name">' + esc(nameOf(s)) + '</div>'
        + '<div class="dk-slot-sub">' + esc(chanceText(s)) + '</div>'
        + '<div class="dk-slot-stat"><span>HP <b>' + fmtStatSafe(st.hp) + '</b></span><span>ATK <b>' + fmtStatSafe(st.atk) + '</b></span></div>'
        + '</div></div>';
    }
    wrap.innerHTML = out;

    Array.prototype.forEach.call(wrap.querySelectorAll('[data-slot]'), function (node) {
      node.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-clear]')) return;
        var s = stackById(deckArr()[+node.getAttribute('data-slot')]);
        if (s) openDossier(s.id);
      });
    });
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-clear]'), function (node) {
      node.addEventListener('click', function (ev) {
        ev.stopPropagation();
        safe(function () { setDeckSlot(+node.getAttribute('data-clear'), null); });
        afterWrite();
      });
    });
  }

  function renderSupport() {
    var wrap = el('dkSuppWrap');
    if (!wrap) return;
    var info = supportSlotInfo();
    var out = '';
    for (var i = 0; i < info.length; i++) {
      var it = info[i];
      var isPet = it.kind === 'pet';
      var tag = isPet ? 'PET' : ('ART ' + (it.idx + 1));
      if (!it.def) {
        out += '<button class="dk-sp empty" data-supp="' + i + '" style="--dk-mc:rgba(245,245,245,.2)" aria-label="Support slot ' + (i + 1) + ' empty">'
          + '<span class="dk-sp-tag">' + tag + '</span>'
          + '<span class="mark">' + (isPet ? ICON_PET : ICON_ART) + '</span>'
          + '</button>';
        continue;
      }
      out += '<button class="dk-sp filled" data-supp="' + i + '" style="--dk-mc:' + (it.def.color || '#8fd3ff') + '" aria-label="' + esc(it.def.name) + '">'
        + '<span class="dk-sp-tag">' + tag + '</span>'
        + '<img src="' + esc(supportImg(it.def)) + '" alt="' + esc(it.def.name) + '" width="96" height="96" decoding="async" onerror="this.onerror=null;this.src=\'assets/images/icon-index-card.webp\'">'
        + '<span class="dk-sp-name">' + esc(it.def.name) + '</span>'
        + '</button>';
    }
    wrap.innerHTML = out;
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-supp]'), function (node) {
      node.addEventListener('click', function () {
        /* artefak/pet dikelola di Backpack; di sini cukup arahkan ke tab yang benar */
        var idx = +node.getAttribute('data-supp');
        var tab = idx === 2 ? 'pet' : 'artefact';
        closeDeckModal(true);
        setTimeout(function () {
          if (typeof bpSetTab === 'function' && typeof toggleBackpack === 'function') {
            safe(function () { bpSetTab(tab); });
            safe(function () { toggleBackpack(); });
          } else if (typeof toggleBackpack === 'function') {
            safe(function () { toggleBackpack(); });
          }
        }, 60);
      });
    });
  }

  function renderMeta() {
    var d = deckArr();
    var filled = 0, best = null, bestChance = -1;
    for (var i = 0; i < 4; i++) {
      var s = stackById(d[i]);
      if (!s) continue;
      filled++;
      var ch = chanceOf(s);
      if (ch > bestChance) { bestChance = ch; best = s; }
    }
    var pw = safe(function () { return totalPower(); }, 0);
    if (el('dkTsPower')) el('dkTsPower').textContent = fmtSafe(pw);
    if (el('dkTsSlots')) el('dkTsSlots').textContent = filled + ' / 4';
    if (el('dkDeckCount')) el('dkDeckCount').textContent = '[ ' + filled + ' / 4 ]';
    if (el('dkMPower')) el('dkMPower').textContent = fmtStatSafe(pw);
    if (el('dkMLuck')) {
      /* LUCK = angka ASLI dari totalLuck() (data.js), bukan rumus prototipe
         "1 + slot x 0.25" yang dulu dipakai lab. totalLuck() sudah menggabungkan
         base + skill tree + artefak + pet + weather + global + rebirth + ad.
         Nilai besar (artefak + pet + rebirth) bisa jutaan, jadi diringkas pakai
         fmtStat supaya tidak meluber ke sel CHANCE di sebelahnya. */
      var luck = safe(function () { return totalLuck(); }, 1);
      luck = Number(luck) || 1;
      el('dkMLuck').textContent = luck >= 1000
        ? 'x' + fmtStatSafe(luck)
        : 'x' + (Math.round(luck * 100) / 100).toFixed(2);
    }
    if (el('dkMChance')) el('dkMChance').textContent = best ? chanceText(best).replace('1 in ', '1/') : '—';

    if (el('dkBrSlot')) {
      el('dkBrSlot').textContent = filled + ' / 4';
      el('dkBrPower').textContent = fmtSafe(pw);
      var sup = supportSlotInfo().filter(function (x) { return !!x.def; }).map(function (x) { return x.def.name; });
      el('dkBrSupp').textContent = sup.length ? sup.join(' · ') : 'EMPTY';
      el('dkBrChance').textContent = best ? chanceText(best) : '—';
      el('dkBrArch').textContent = stacks().length + ' CARDS';
      var rows = '';
      for (var k = 0; k < 4; k++) {
        var sk = stackById(d[k]);
        if (!sk) {
          rows += '<div class="lr empty"><i>0' + (k + 1) + '</i><span class="nm">— EMPTY SLOT —</span><span class="sc">—</span></div>';
          continue;
        }
        rows += '<div class="lr" style="--dk-mc:' + mutColor(sk) + '">'
          + '<i>0' + (k + 1) + '</i>'
          + '<span class="av"><img src="' + esc(thumbOf(sk)) + '" alt="" width="40" height="40" decoding="async"></span>'
          + '<span class="nm">' + esc(nameOf(sk)) + '</span>'
          + '<span class="sc">' + fmtStatSafe(powerOf(sk)) + '</span>'
          + '</div>';
      }
      if (el('dkBrRows')) el('dkBrRows').innerHTML = rows;
    }
  }

  function renderRtabs() {
    var tabs = document.querySelectorAll('#deckModal .dk-rtab');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-rt') === DKM.rtab;
      tabs[i].classList.toggle('on', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  /* EQUIP BEST (deck) = isi 4 slot dengan kartu POWER tertinggi.
     Beda dari bpEquipBest() Backpack yang memilih varian paling LANGKA.
     Tie-break: power -> chance -> nama, supaya hasil deterministik. */
  function equipBestByPower() {
    var list = stacks().filter(function (s) { return s && s.char; });
    if (!list.length) return;
    list.sort(function (a, b) {
      return (powerOf(b) - powerOf(a))
        || (chanceOf(b) - chanceOf(a))
        || nameOf(a).localeCompare(nameOf(b));
    });
    var next = [null, null, null, null];
    list.slice(0, 4).forEach(function (s, i) { next[i] = s.id; });
    if (!hasState()) return;
    state.deck = next;
    state.equippedId = next[0] || null;
    state.equippedId2 = next[1] || null;
    afterWrite();
  }

  /* Urutan baku arsip deck: KARTU TERPASANG dulu (paling atas), lalu FAVORIT,
     baru sort yang dipilih user (default POWER). Cermin bpCompareBaku() Backpack,
     tapi tanpa tie-break rarity — di deck yang menentukan power, bukan chance. */
  function cardList() {
    var list = stacks().slice();
    var d = deckArr();
    if (DKM.inDeckOnly) {
      list = list.filter(function (s) { return d.indexOf(s.id) >= 0; });
    }
    if (DKM.mutFilter !== 'all') {
      list = list.filter(function (s) {
        if (DKM.mutFilter === 'shiny') return !!s.shiny;
        return (s.mut || 'none') === DKM.mutFilter;
      });
    }
    if (DKM.q) {
      var q = DKM.q.toLowerCase();
      list = list.filter(function (s) {
        return nameOf(s).toLowerCase().indexOf(q) >= 0 || mutLabel(s).toLowerCase().indexOf(q) >= 0;
      });
    }
    function deckRank(s) { return d.indexOf(s.id) >= 0 ? 1 : 0; }
    function favRank(s) { return s.fav ? 1 : 0; }
    list.sort(function (a, b) {
      var r = deckRank(b) - deckRank(a);          /* terpasang di atas */
      if (r) return r;
      r = favRank(b) - favRank(a);                /* favorit menyusul */
      if (r) return r;
      if (DKM.sortMode === 'chance') return chanceOf(b) - chanceOf(a);
      if (DKM.sortMode === 'name') return nameOf(a).localeCompare(nameOf(b));
      return powerOf(b) - powerOf(a);             /* default: POWER */
    });
    return list;
  }

  function renderGrid() {
    var grid = el('dkGrid');
    var nr = el('dkNr');
    if (!grid) return;
    var out = '';

    if (DKM.rtab === 'cards') {
      var d = deckArr();
      var list = cardList();
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        var indeck = d.indexOf(s.id) >= 0;
        var mk = mutKey(s);
        var hzCls = (typeof hzBorderCls === 'function') ? hzBorderCls(mk || 'none', !!s.shiny, { tile: true, dense: true }) : '';
        var hzLayers = (typeof hzBorderLayerHtml === 'function') ? hzBorderLayerHtml() : '';
        var stHtml = '';
        if (s.shiny && typeof shinyStampHtml === 'function') stHtml += shinyStampHtml(true);
        if (mk && typeof mutStampHtml === 'function') stHtml += mutStampHtml(mk, true);
        if (s.trait && s.trait !== 'none' && typeof traitStampHtml === 'function') stHtml += traitStampHtml(s.trait, true);
        out += '<button class="dk-card' + (mk ? ' mut' : '') + (indeck ? ' indeck' : '') + hzCls + '" data-card="' + esc(s.id) + '" style="--dk-mc:' + mutColor(s) + '" aria-label="' + esc(nameOf(s)) + '">'
          + hzLayers
          + (s.count > 1 ? '<span class="dk-card-cnt">x' + s.count + '</span>' : '')
          + (indeck ? '<span class="dk-card-indeck">EQUIPPED</span>' : '')
          + (stHtml ? '<span class="dk-card-stamps">' + stHtml + '</span>' : '')
          + (s.fav ? '<span class="dk-card-fav">' + ICON_STAR + '</span>' : '')
          + '<img src="' + esc(thumbOf(s)) + '" alt="' + esc(nameOf(s)) + '" width="96" height="96" decoding="async" onerror="this.onerror=null;this.src=\'assets/images/icon-index-card.webp\'">'
          + '<span class="dk-card-foot">' + esc(chanceText(s)) + '</span>'
          + '</button>';
      }
      if (el('dkArchCount')) el('dkArchCount').textContent = list.length;
      if (nr) nr.style.display = list.length ? 'none' : 'block';
    } else {
      var items = supportPool();
      for (var j = 0; j < items.length; j++) {
        var it = items[j];
        var on = isSupportEquipped(it);
        out += '<button class="dk-card' + (on ? ' indeck' : '') + '" data-supitem="' + esc(it.kind + ':' + it.def.id) + '" style="--dk-mc:' + (it.def.color || '#8fd3ff') + '" aria-label="' + esc(it.def.name) + '">'
          + (on ? '<span class="dk-card-indeck">SLOT</span>' : '')
          + '<img src="' + esc(supportImg(it.def)) + '" alt="' + esc(it.def.name) + '" width="96" height="96" decoding="async" onerror="this.onerror=null;this.src=\'assets/images/icon-index-card.webp\'">'
          + '<span class="dk-card-foot">' + esc(luckText(it.def)) + '</span>'
          + '</button>';
      }
      if (el('dkArchCount')) el('dkArchCount').textContent = items.length;
      if (nr) nr.style.display = items.length ? 'none' : 'block';
    }

    grid.innerHTML = out;

    Array.prototype.forEach.call(grid.querySelectorAll('[data-card]'), function (node) {
      node.addEventListener('click', function (ev) {
        var id = node.getAttribute('data-card');
        if (ev.shiftKey) {
          var d = deckArr();
          var at = d.indexOf(id);
          if (at >= 0) safe(function () { setDeckSlot(at, null); });
          afterWrite();
          return;
        }
        openDossier(id);
      });
    });
    Array.prototype.forEach.call(grid.querySelectorAll('[data-supitem]'), function (node) {
      node.addEventListener('click', function () {
        var parts = String(node.getAttribute('data-supitem')).split(':');
        toggleSupport(parts[0], parts[1]);
      });
    });
  }

  /* ---------------------------- card dossier --------------------------- */
  /* Isi modal = SKILL/PASSIVE kartu (bukan teks generik). Sumber: CARDS[char].passive
     = { name, desc } dari MASTER_CARD_INDEX (cermin STORY_BIBLE units: skill + desc). */
  function passiveOf(s) {
    var c = safe(function () { return CARDS[s.char]; }, null);
    if (!c || !c.passive) return null;
    var name = String(c.passive.name || '').trim();
    var desc = String(c.passive.desc || '').trim();
    if (!name && !desc) return null;
    return { name: name, desc: desc };
  }
  function traitInfo(s) {
    var k = s && s.trait;
    if (!k || k === 'none') return null;
    var t = safe(function () { return TRAIT[k]; }, null);
    if (!t) return null;
    return {
      name: safe(function () { return traitLabel(k); }, String(k).toUpperCase()),
      fx: safe(function () { return traitFxList(k); }, ''),
      color: t.color || 'var(--dk-ink)'
    };
  }
  function weatherOf(s) {
    return safe(function () { return bpWeatherOf(s); }, null);
  }

  function openDossier(id) {
    var s = stackById(id);
    if (!s) return;
    DKM.cardId = id;
    var st = statOf(s);
    var col = mutColor(s);
    var slotAt = deckArr().indexOf(id);
    var body = el('dkCardModalBody');
    if (!body) return;

    var pas = passiveOf(s);
    var tr = traitInfo(s);
    var wx = weatherOf(s);
    var mk = mutKey(s);
    var tk = (s.trait && s.trait !== 'none') ? s.trait : '';
    var martCls = (typeof hzBorderCls === 'function') ? hzBorderCls(mk || 'none', !!s.shiny) : '';
    var martLayers = (typeof hzBorderLayerHtml === 'function') ? hzBorderLayerHtml() : '';
    var martStamps = '';
    if (s.shiny && typeof shinyStampHtml === 'function') martStamps += shinyStampHtml(true);
    if (mk && typeof mutStampHtml === 'function') martStamps += mutStampHtml(mk, true);
    if (tk && typeof traitStampHtml === 'function') martStamps += traitStampHtml(tk, true);

    var tagBadges = '';
    if (s.shiny && typeof shinyStampHtml === 'function') tagBadges += shinyStampHtml(false);
    if (mk && typeof mutStampHtml === 'function') tagBadges += mutStampHtml(mk, false);
    if (!tagBadges) tagBadges = '<span class="dk-mtag" style="--dk-mc:' + col + '">' + esc(mutLabel(s)) + '</span>';

    var skillHtml = '';
    if (pas) {
      skillHtml =
        '<div class="dk-mskill">'
        + '<div class="dk-mskill-h"><span class="dk-mskill-k">PASSIVE SKILL</span></div>'
        + (pas.name ? '<div class="dk-mskill-n">' + esc(pas.name) + '</div>' : '')
        + (pas.desc ? '<p class="dk-mskill-d">' + esc(pas.desc) + '</p>' : '')
        + '</div>';
    }
    var trGem = (tk && typeof traitGem === 'function') ? traitGem(15, tk) : '';
    var traitHtml = tr
      ? '<div class="dk-mskill dk-mtrait" style="--dk-mc:' + esc(tr.color) + '">'
      + '<div class="dk-mskill-h"><span class="dk-mskill-k">TRAIT</span></div>'
      + '<div class="dk-mskill-n" style="color:' + esc(tr.color) + '">' + trGem + '<span>' + esc(tr.name) + '</span></div>'
      + (tr.fx ? '<p class="dk-mskill-d">' + esc(tr.fx) + '</p>' : '')
      + '</div>'
      : '';

    body.innerHTML =
      '<div class="dk-mart' + martCls + '" style="--dk-mc:' + col + '">' + martLayers + (martStamps ? '<span class="dk-mart-stamps">' + martStamps + '</span>' : '') + '<img src="' + esc(thumbOf(s)) + '" alt="' + esc(nameOf(s)) + '"></div>'
      + '<div class="dk-minfo">'
      + '<div class="dk-mname" style="color:' + (mk ? col : 'var(--dk-ink)') + '">' + esc(nameOf(s)) + '</div>'
      + '<div class="dk-mtags">'
      + tagBadges
      + '<span class="dk-mtag" style="--dk-mc:rgba(245,245,245,.55)">' + esc(chanceText(s)) + '</span>'
      + (wx && wx.name ? '<span class="dk-mtag" style="--dk-mc:' + esc(wx.color || 'var(--dk-ink)') + '">' + esc(wx.name) + '</span>' : '')
      + (slotAt >= 0 ? '<span class="dk-mtag" style="--dk-mc:var(--dk-haz)">SLOT 0' + (slotAt + 1) + '</span>' : '')
      + '</div>'
      + '<div class="dk-mstats">'
      + '<div class="dk-mstat"><k>HP</k><v>' + fmtStatSafe(st.hp) + '</v></div>'
      + '<div class="dk-mstat"><k>ATK</k><v>' + fmtStatSafe(st.atk) + '</v></div>'
      + '</div>'
      + skillHtml + traitHtml
      + '</div>';

    var foot = el('dkCardModalFoot');
    if (foot) {
      foot.innerHTML =
        '<button class="dk-mbtn primary" id="dkModalEquip">' + ICON_EQUIP + 'EQUIP</button>'
        + '<button class="dk-mbtn' + (s.fav ? ' on' : '') + '" id="dkModalFav">' + (s.fav ? ICON_STAR : ICON_STAR_O) + (s.fav ? 'FAVORITED' : 'FAVORITE') + '</button>';
      var be = el('dkModalEquip');
      if (be) be.addEventListener('click', function () { openSlotPicker(id); });
      var bf = el('dkModalFav');
      if (bf) bf.addEventListener('click', function () {
        s.fav = !s.fav;
        safe(function () { save(); });
        openDossier(id);
        renderGrid();
      });
    }
    var m = el('deckCardModal');
    if (m) m.classList.add('on');
  }

  function closeDossier() {
    var m = el('deckCardModal');
    if (m) m.classList.remove('on');
    DKM.cardId = null;
  }

  /* ---------------------------- slot picker ---------------------------- */
  function openSlotPicker(id) {
    var s = stackById(id);
    if (!s) return;
    DKM.slotFor = id;
    if (el('dkSlotPopSub')) el('dkSlotPopSub').textContent = nameOf(s);
    var d = deckArr();
    var out = '';
    for (var i = 0; i < 4; i++) {
      var cur = stackById(d[i]);
      if (!cur) {
        out += '<button class="dk-spopt empty" data-slot="' + i + '" aria-label="Equip to empty slot ' + (i + 1) + '">'
          + '<span class="no">0' + (i + 1) + '</span>' + ICON_PLUS + '</button>';
        continue;
      }
      var cmk = mutKey(cur);
      var spCls = (typeof hzBorderCls === 'function') ? hzBorderCls(cmk || 'none', !!cur.shiny, { tile: true }) : '';
      var spLayers = (typeof hzBorderLayerHtml === 'function') ? hzBorderLayerHtml() : '';
      var spStamps = '';
      if (cur.shiny && typeof shinyStampHtml === 'function') spStamps += shinyStampHtml(true);
      if (cmk && typeof mutStampHtml === 'function') spStamps += mutStampHtml(cmk, true);
      if (cur.trait && cur.trait !== 'none' && typeof traitStampHtml === 'function') spStamps += traitStampHtml(cur.trait, true);
      out += '<button class="dk-spopt' + spCls + '" data-slot="' + i + '" style="--dk-mc:' + mutColor(cur) + '" aria-label="Replace slot ' + (i + 1) + ': ' + esc(nameOf(cur)) + '">'
        + spLayers
        + '<span class="no">0' + (i + 1) + '</span>'
        + (spStamps ? '<span class="dk-sp-stamps">' + spStamps + '</span>' : '')
        + '<img src="' + esc(thumbOf(cur)) + '" alt="' + esc(nameOf(cur)) + '" width="64" height="64" decoding="async" onerror="this.onerror=null;this.src=\'assets/images/icon-index-card.webp\'">'
        + '<span class="nm">' + esc(nameOf(cur)) + '</span>'
        + '</button>';
    }
    var g = el('dkSlotGrid');
    if (!g) return;
    g.innerHTML = out;
    Array.prototype.forEach.call(g.querySelectorAll('[data-slot]'), function (node) {
      node.addEventListener('click', function () {
        var slot = +node.getAttribute('data-slot');
        safe(function () { setDeckSlot(slot, DKM.slotFor); });
        closeSlotPicker();
        closeDossier();
        afterWrite();
      });
    });
    var p = el('deckSlotPop');
    if (p) p.classList.add('on');
  }

  function closeSlotPicker() {
    var p = el('deckSlotPop');
    if (p) p.classList.remove('on');
    DKM.slotFor = null;
  }

  /* --------------------------- write + refresh ------------------------- */
  function afterWrite() {
    safe(function () { save(); });
    renderSlots(); renderSupport(); renderMeta(); renderGrid();
    /* lobby di belakang ikut segar; render() penuh aman karena modal di atasnya */
    if (typeof refreshLobbyDeckUI === 'function') safe(refreshLobbyDeckUI);
    if (document.body.classList.contains('bp-open') && typeof renderBackpackPanel === 'function') {
      safe(renderBackpackPanel);
    }
  }

  /* --------------------------- hazard banner --------------------------- */
  function curtain() { return el('deckCurtain'); }
  function clearTimers() {
    for (var i = 0; i < DKM.timers.length; i++) clearTimeout(DKM.timers[i]);
    DKM.timers = [];
  }
  function setCopy(mode) {
    var kick = el('dkHzKick'), title = el('dkHzTitle'), sub = el('dkHzSub'),
      foot = el('dkHzFoot'), serial = el('dkHzSerial'), water = el('dkHzWater');
    var hex = (0x1000 + Math.floor(Math.random() * 0xefff)).toString(16).toUpperCase();
    if (serial) serial.textContent = hex;
    if (mode === 'open') {
      if (kick) kick.innerHTML = '// SQUADRON <b>UPLINK</b>';
      if (title) title.textContent = 'DECK';
      if (water) water.textContent = 'DECK';
      if (sub) sub.textContent = 'LOADOUT MATRIX — 4 SLOTS + SUPPORT';
      if (foot) foot.textContent = 'SYNC LOADOUT';
    } else {
      if (kick) kick.innerHTML = '// LINK <b>STAND BY</b>';
      if (title) title.textContent = 'HOLD';
      if (water) water.textContent = 'OUT';
      if (sub) sub.textContent = 'DECK DISCONNECTING — DATA SAVED';
      if (foot) foot.textContent = 'CLOSE SESSION';
    }
  }

  function bannerOpen() {
    var c = curtain();
    if (!c) return;
    clearTimers();
    setCopy('open');
    c.className = '';
    void c.offsetWidth;
    c.classList.add('on', 'smooth', 'sweep');
    DKM.timers.push(setTimeout(function () { c.classList.add('revealed'); }, 1080));
    DKM.timers.push(setTimeout(function () {
      c.classList.remove('on', 'smooth', 'sweep', 'revealed');
    }, 1800));
  }

  /* EXIT = 3 fase: (1) tirai MENUTUP, (2) konten disembunyikan, (3) tirai MEMBUKA ke atas/bawah.
     Fase 3 WAJIB — tanpanya layar tertahan tertutup ("banner tidak kebuka"). */
  function bannerClose(onCovered) {
    var c = curtain();
    if (!c) { if (onCovered) onCovered(); return; }
    clearTimers();
    setCopy('close');
    c.className = '';
    c.classList.add('on', 'smooth', 'revealed');
    void c.offsetWidth;
    c.classList.remove('revealed');                       /* fase 1: tutup */
    DKM.timers.push(setTimeout(function () {
      if (onCovered) onCovered();                         /* fase 2: konten hilang */
    }, 560));
    DKM.timers.push(setTimeout(function () {
      c.classList.add('revealed');                        /* fase 3: buka lagi */
    }, 780));
    DKM.timers.push(setTimeout(function () {
      c.classList.remove('on', 'smooth', 'revealed');
    }, 1560));
  }

  /* ------------------------------ open/close --------------------------- */
  function openDeckModal() {
    var m = el('deckModal');
    if (!m || _open) return;
    _open = true;
    safe(function () { if (window.sfx && sfx.hit) sfx.hit(); });
    DKM.q = '';
    DKM.inDeckOnly = false;
    DKM.mutFilter = 'all';
    DKM.rtab = 'cards';
    var search = el('dkSearch');
    if (search) search.value = '';
    var chipDeck = el('dkChipDeck');
    if (chipDeck) chipDeck.classList.remove('on');
    var chipFilter = el('dkChipFilter');
    if (chipFilter) {
      chipFilter.classList.remove('on');
      var cf = chipFilter.querySelector('.cv');
      if (cf) cf.textContent = 'ALL';
    }
    m.classList.add('show');
    document.body.classList.add('deck-open');
    renderSlots(); renderSupport(); renderMeta(); renderRtabs(); renderGrid();
    bannerOpen();
  }

  function closeDeckModal(silent) {
    var m = el('deckModal');
    if (!m || !_open) return;
    _open = false;
    closeSlotPicker();
    closeDossier();
    var hide = function () {
      m.classList.remove('show');
      document.body.classList.remove('deck-open');
      /* lobby di belakang ikut segar (poster/party memakai state.deck) */
      if (typeof render === 'function') safe(render);
    };
    if (silent) { hide(); return; }
    bannerClose(hide);
  }

  /* ------------------------------- wiring ------------------------------ */
  function bind() {
    var m = el('deckModal');
    if (!m || m.__dkBound) return;
    m.__dkBound = true;

    var x = el('dkClose');
    if (x) x.addEventListener('click', function () { closeDeckModal(); });

    Array.prototype.forEach.call(document.querySelectorAll('#deckModal .dk-rtab'), function (b) {
      b.addEventListener('click', function () {
        DKM.rtab = b.getAttribute('data-rt');
        renderRtabs(); renderGrid();
      });
    });

    var search = el('dkSearch');
    if (search) search.addEventListener('input', function (e) { DKM.q = e.target.value; renderGrid(); });

    var chipDeck = el('dkChipDeck');
    if (chipDeck) chipDeck.addEventListener('click', function () {
      DKM.inDeckOnly = !DKM.inDeckOnly;
      chipDeck.classList.toggle('on', DKM.inDeckOnly);
      renderGrid();
    });

    var chipSort = el('dkChipSort');
    if (chipSort) chipSort.addEventListener('click', function () {
      var order = ['power', 'chance', 'name'];
      var labels = { power: 'POWER', chance: 'CHANCE', name: 'NAME' };
      DKM.sortMode = order[(order.indexOf(DKM.sortMode) + 1) % order.length];
      var cv = chipSort.querySelector('.cv');
      if (cv) cv.textContent = labels[DKM.sortMode];
      renderGrid();
    });

    var chipFilter = el('dkChipFilter');
    if (chipFilter) chipFilter.addEventListener('click', function () {
      var keys = ['all', 'gold', 'rainbow', 'secret', 'ultima', 'shiny'];
      var labels = { all: 'ALL', gold: 'GOLD', rainbow: 'RAINBOW', secret: 'SECRET', ultima: 'ULTIMA', shiny: 'SHINY' };
      DKM.mutFilter = keys[(keys.indexOf(DKM.mutFilter) + 1) % keys.length];
      var cv = chipFilter.querySelector('.cv');
      if (cv) cv.textContent = labels[DKM.mutFilter];
      chipFilter.classList.toggle('on', DKM.mutFilter !== 'all');
      renderGrid();
    });

    var best = el('dkActBest');
    if (best) best.addEventListener('click', function () {
      /* EQUIP BEST di layar DECK = 4 kartu POWER tertinggi (permintaan user
         2026-11-07). SENGAJA tidak memanggil bpEquipBest() milik Backpack:
         fungsi itu memilih varian PALING LANGKA (luckChance), bukan power. */
      equipBestByPower();
    });

    var clr = el('dkActClear');
    if (clr) clr.addEventListener('click', function () {
      for (var i = 0; i < 4; i++) safe(function () { setDeckSlot(i, null); });
      afterWrite();
    });

    var cardX = el('dkCardModalX');
    if (cardX) cardX.addEventListener('click', closeDossier);
    var cardModal = el('deckCardModal');
    if (cardModal) cardModal.addEventListener('click', function (ev) { if (ev.target === cardModal) closeDossier(); });

    var slotX = el('dkSlotPopX');
    if (slotX) slotX.addEventListener('click', closeSlotPicker);
    var slotPop = el('deckSlotPop');
    if (slotPop) slotPop.addEventListener('click', function (ev) { if (ev.target === slotPop) closeSlotPicker(); });
  }

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape' || !_open) return;
    var sp = el('deckSlotPop'), cm = el('deckCardModal');
    if (sp && sp.classList.contains('on')) { closeSlotPicker(); return; }
    if (cm && cm.classList.contains('on')) { closeDossier(); return; }
    closeDeckModal();
  });

  window.openDeckModal = openDeckModal;
  window.closeDeckModal = closeDeckModal;
  window.deckEquipBest = equipBestByPower;
  window.deckModalRender = function () {
    if (!_open) return;
    renderSlots(); renderSupport(); renderMeta(); renderGrid();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
