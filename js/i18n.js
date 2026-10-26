/* =============== GLOBAL LANGUAGE SYSTEM (ID / EN) ===============
 * Menyediakan pilihan Bahasa Indonesia ('id') & English ('en') di menu Settings.
 * - Menyimpan preferensi di localStorage ('acb_lang_v1') & state.lang.
 * - Menerjemahkan otomatis seluruh teks UI (statis di index.html maupun dinamis
 *   yang di-render oleh JS) secara real-time menggunakan kamus frasa + regex +
 *   MutationObserver ringan.
 */
(function () {
  var LANG_STORAGE_KEY = 'acb_lang_v1';

  function getLang() {
    try {
      if (typeof state !== 'undefined' && state && (state.lang === 'en' || state.lang === 'id')) {
        return state.lang;
      }
      var saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'en' || saved === 'id') return saved;
    } catch (e) {}
    return 'id';
  }

  function setLang(lang) {
    lang = (lang === 'en') ? 'en' : 'id';
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
      if (typeof state !== 'undefined' && state) {
        state.lang = lang;
        if (typeof save === 'function') save();
      }
    } catch (e) {}
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-lang', lang);

    if (lang === 'id') {
      restoreOriginalDOM(document.body);
      if (typeof render === 'function') render();
    } else {
      if (typeof render === 'function') render();
      translateSubtree(document.body);
    }
  }

  /* Kamus Frasa Eksak (trimmed string -> English) */
  var EXACT_MAP = {
    // Auth & Loading
    'Memuat…': 'Loading…',
    'Memproses…': 'Processing…',
    'Akun berhasil dibuat': 'Account Created Successfully',
    'Silakan masuk dengan akun barumu.': 'Please sign in with your new account.',
    'KE LOGIN': 'GO TO LOGIN',
    'Verifikasi Berhasil': 'Verification Successful',
    'AKSES DIBERIKAN': 'ACCESS GRANTED',
    'Selamat datang kembali, Hunter': 'Welcome back, Hunter',
    'Masuki Arena': 'Enter Arena',
    'MASUK': 'LOGIN',
    'DAFTAR': 'REGISTER',
    'BUAT AKUN': 'CREATE ACCOUNT',
    'nama shinobi': 'shinobi username',
    'Progres tersinkron ke Cloud': 'Progress synced to Cloud',

    // Topbar & Navigation
    'Buka profil': 'Open Profile',
    'Ganti Avatar dari Galeri': 'Change Avatar from Gallery',
    'Pengaturan': 'Settings',
    'KEMBALI KE LOBBY': 'BACK TO LOBBY',
    'Kembali ke Lobby': 'Back to Lobby',
    'KEMBALI': 'BACK',
    'Kembali': 'Back',
    'TUTUP': 'CLOSE',
    'Tutup': 'Close',
    'BATAL': 'CANCEL',
    'Batal': 'Cancel',
    'BELI': 'BUY',
    'AKTIFKAN': 'ACTIVATE',
    'TUMPUK': 'STACK',
    'Sembunyikan': 'Hide',
    'KLIK': 'CLICK',
    'UNTUK BUKA BACKPACK': 'TO OPEN BACKPACK',

    // Settings Page
    'Kecepatan aksi & giliran:': 'Action & turn speed:',
    'Kalau battle terasa hening, cek status di bawah lalu tekan tes nada.': 'If battle feels silent, check the status below and press tone test.',
    'TES NADA': 'TEST TONE',
    'TES SFX RAID (HIT + DENTUMAN)': 'TEST RAID SFX (HIT + IMPACT)',
    'AUTO RESTART DARI LANTAI 1': 'AUTO RESTART FROM FLOOR 1',
    'AUTO RESTART AKTIF — kalah = langsung mulai run baru dari Lantai 1.': 'AUTO RESTART ON — defeat immediately starts a new run from Floor 1.',
    'Auto restart mati — kalah = kembali ke menu Tower.': 'Auto restart off — defeat returns to the Tower menu.',
    'Keluar Akun': 'Log Out',
    'RESET DATA LOKAL': 'RESET LOCAL DATA',
    'Reset Semua & Main Dari Awal': 'Reset All & Start Fresh',
    'Yakin? Tap lagi untuk reset': 'Are you sure? Tap again to reset',
    'BAHASA / LANGUAGE': 'LANGUAGE / BAHASA',
    'Pilih bahasa tampilan antarmuka game (tersimpan otomatis).': 'Select the game interface display language (saved automatically).',

    // Global Luck & Weather
    'Buff keberuntungan seluruh server (+10×/stack)': 'Server-wide luck buff (+10×/stack)',
    'Belum aktif — buff keberuntungan untuk seluruh server': 'Inactive — server-wide luck buff for all players',
    'Belum aktif — efek untuk semua pemain': 'Inactive — effect applies to all players',
    'AKTIVASI GLOBAL LUCK': 'ACTIVATE GLOBAL LUCK',
    'TUMPUK GLOBAL LUCK': 'STACK GLOBAL LUCK',
    'KONFIRMASI': 'CONFIRMATION',
    'AKUN': 'ACCOUNT',
    'EFEK': 'EFFECT',
    'DURASI': 'DURATION',
    'HARGA': 'PRICE',
    'SALDO': 'BALANCE',
    '+1 JAM per aktivasi (maks. 10 jam)': '+1 HOUR per activation (max 10 hours)',
    'DIBATALKAN': 'CANCELLED',
    'Pembelian Global Luck dibatalkan': 'Global Luck purchase cancelled',
    'GEMS TIDAK CUKUP': 'NOT ENOUGH GEMS',
    'SUDAH MAX STACK': 'MAX STACK REACHED',

    // Leaderboard & Profile Modal
    'PAPAN PERINGKAT GLOBAL': 'GLOBAL LEADERBOARD',
    'Memuat data peringkat dari server…': 'Loading leaderboard data from server…',
    'Memuat profil Hunter…': 'Loading Hunter profile…',
    'Gagal memuat profil.': 'Failed to load profile.',
    'KARTU UTAMA': 'MAIN CARD',
    'UNIT TERKUAT': 'STRONGEST UNIT',
    'KARTU LOBBY': 'LOBBY CARD',
    'STATISTIK': 'STATISTICS',
    'PERINGKAT': 'STANDINGS',
    'BELUM ADA KARTU': 'NO CARD EQUIPPED',

    // Backpack, Index, Shop, Raid, Tower
    'TAS KARTU': 'CARD BACKPACK',
    'KOLEKSI KARTU': 'CARD COLLECTION',
    'SEMUA': 'ALL',
    'TERKUNCI': 'LOCKED',
    'TERPASANG': 'EQUIPPED',
    'PASANG': 'EQUIP',
    'LEPAS': 'UNEQUIP',
    'JUAL': 'SELL',
    'KUNCI': 'LOCK',
    'BUKA KUNCI': 'UNLOCK',
    'MULAI BATTLE': 'START BATTLE',
    'MULAI RAID': 'START RAID',
    'MULAI TOWER': 'START TOWER',
    'MENANG!': 'VICTORY!',
    'KALAH!': 'DEFEAT!',
    'HADIAH': 'REWARDS',
    'LANTAI': 'FLOOR',
    'GILIRAN': 'TURN'
  };

  /* Pasangan pola substring/regex untuk kalimat dinamis */
  var PATTERN_PAIRS = [
    [/Masuk untuk melanjutkan/g, 'Sign in to continue'],
    [/perjalananmu/g, 'your journey'],
    [/menaklukkan arena dan membangun shadow army\./g, 'conquering the arena and building your shadow army.'],
    [/Buat akun baru untuk mulai/g, 'Create a new account to start'],
    [/petualanganmu/g, 'your adventure'],
    [/di arena dan kumpulkan kartu terkuat\./g, 'in the arena and collect the strongest cards.'],
    [/Selamat datang kembali/g, 'Welcome back'],
    [/Selamat datang/g, 'Welcome'],
    [/SUARA:\s*MATI/g, 'SOUND: OFF'],
    [/SUARA:\s*NYALA/g, 'SOUND: ON'],
    [/SUARA:\s*-/g, 'SOUND: -'],
    [/SFX:\s*MATI/g, 'SFX: OFF'],
    [/SFX:\s*NYALA/g, 'SFX: ON'],
    [/belum dibuat/g, 'not created'],
    [/LEVEL KAMU:/g, 'YOUR LEVEL:'],
    [/SPEED AKTIF:/g, 'ACTIVE SPEED:'],
    [/Berikutnya terbuka di LV/g, 'Next unlocks at LV'],
    [/SUDAH MAX/g, 'MAXED OUT'],
    [/di LV /g, 'at LV '],
    [/AKTIFKAN\s*·/g, 'ACTIVATE ·'],
    [/TUMPUK\s*\+10×\s*·/g, 'STACK +10× ·'],
    [/(\d+)\s*tumpuk/gi, '$1 stacks'],
    [/Tumpukan ke/g, 'Stack to'],
    [/Aktifkan/g, 'Activate'],
    [/untuk semua pemain/g, 'for all players'],
    [/untuk semua server!/g, 'for the entire server!'],
    [/SELURUH SERVER MENDAPATKAN/g, 'THE ENTIRE SERVER RECEIVES'],
    [/UNTUK SEMUA PEMAIN!/g, 'FOR ALL PLAYERS!'],
    [/DIONSOROI OLEH:/g, 'SPONSORED BY:'],
    [/DISPONSORI OLEH:/g, 'SPONSORED BY:'],
    [/DIAKTIFKAN OLEH/gi, 'ACTIVATED BY'],
    [/Diaktifkan oleh/g, 'Activated by'],
    [/Gems langsung dipotong dan/g, 'Gems are deducted immediately and'],
    [/tidak bisa dikembalikan/g, 'are non-refundable'],
    [/Aktivasi berlaku untuk seluruh server\./g, 'Activation applies to the entire server.'],
    [/Butuh\s+(\d+)\s+Gems/g, 'Requires $1 Gems'],
    [/Lantai\s+(\d+)/g, 'Floor $1'],
    [/LANTAI\s+(\d+)/g, 'FLOOR $1'],
    [/Giliran\s+(\d+)/g, 'Turn $1'],
    [/GILIRAN\s+(\d+)/g, 'TURN $1']
  ];

  function translateTextString(str) {
    if (!str || !str.trim()) return str;
    var trimmed = str.trim();
    if (EXACT_MAP[trimmed]) {
      return str.replace(trimmed, EXACT_MAP[trimmed]);
    }
    var out = str;
    for (var i = 0; i < PATTERN_PAIRS.length; i++) {
      out = out.replace(PATTERN_PAIRS[i][0], PATTERN_PAIRS[i][1]);
    }
    return out;
  }

  function translateSubtree(root) {
    if (!root || getLang() !== 'en') return;

    // 1. Translate attributes (placeholder, title)
    if (root.nodeType === 1) {
      var els = root.querySelectorAll ? [root].concat(Array.prototype.slice.call(root.querySelectorAll('[placeholder],[title],[data-t]'))) : [root];
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.hasAttribute && el.hasAttribute('placeholder')) {
          var ph = el.getAttribute('placeholder');
          if (!el.hasAttribute('data-orig-ph')) el.setAttribute('data-orig-ph', ph);
          var tPh = translateTextString(el.getAttribute('data-orig-ph'));
          if (ph !== tPh) el.setAttribute('placeholder', tPh);
        }
        if (el.hasAttribute && el.hasAttribute('title')) {
          var ti = el.getAttribute('title');
          if (!el.hasAttribute('data-orig-title')) el.setAttribute('data-orig-title', ti);
          var tTi = translateTextString(el.getAttribute('data-orig-title'));
          if (ti !== tTi) el.setAttribute('title', tTi);
        }
        if (el.hasAttribute && el.hasAttribute('data-t')) {
          var dt = el.getAttribute('data-t');
          if (!el.hasAttribute('data-orig-dt')) el.setAttribute('data-orig-dt', dt);
          var tDt = translateTextString(el.getAttribute('data-orig-dt'));
          if (dt !== tDt) el.setAttribute('data-t', tDt);
        }
      }
    }

    // 2. Walk text nodes
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      var parent = node.parentNode;
      if (!parent) continue;
      var tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') continue;
      var val = node.nodeValue;
      if (!val || !val.trim()) continue;
      if (node.__origIdText === undefined) {
        node.__origIdText = val;
      }
      var translated = translateTextString(node.__origIdText);
      if (node.nodeValue !== translated) {
        node.nodeValue = translated;
      }
    }
  }

  function restoreOriginalDOM(root) {
    if (!root) return;
    if (root.nodeType === 1 && root.querySelectorAll) {
      var els = [root].concat(Array.prototype.slice.call(root.querySelectorAll('[data-orig-ph],[data-orig-title],[data-orig-dt]')));
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.hasAttribute('data-orig-ph')) el.setAttribute('placeholder', el.getAttribute('data-orig-ph'));
        if (el.hasAttribute('data-orig-title')) el.setAttribute('title', el.getAttribute('data-orig-title'));
        if (el.hasAttribute('data-orig-dt')) el.setAttribute('data-t', el.getAttribute('data-orig-dt'));
      }
    }
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      if (node.__origIdText !== undefined && node.nodeValue !== node.__origIdText) {
        node.nodeValue = node.__origIdText;
      }
    }
  }

  /* MutationObserver supaya setiap panel/modal/toast baru otomatis diterjemahkan saat EN aktif */
  var _rafPending = false;
  var _observer = new MutationObserver(function (mutations) {
    if (getLang() !== 'en') return;
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(function () {
      _rafPending = false;
      if (getLang() !== 'en') return;
      translateSubtree(document.body);
    });
  });

  function initLangObserver() {
    var cur = getLang();
    document.documentElement.setAttribute('lang', cur);
    document.documentElement.setAttribute('data-lang', cur);
    if (document.body) {
      if (cur === 'en') translateSubtree(document.body);
      _observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLangObserver);
  } else {
    initLangObserver();
  }

  window.GameLang = {
    get: getLang,
    set: setLang,
    t: function (idText, enText) {
      return getLang() === 'en' ? (enText !== undefined ? enText : translateTextString(idText)) : idText;
    },
    refresh: function () {
      if (getLang() === 'en' && document.body) translateSubtree(document.body);
    }
  };
  window.tLang = window.GameLang.t;
})();
