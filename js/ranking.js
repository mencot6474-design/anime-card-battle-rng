/* ==========================================================================
   LEADERBOARD — panel dari tile hub lobby.
   Data: RPC get_leaderboard (board world_boss / world_boss_b / inf_tower /
   deck_power / rarest_pull).
   ========================================================================== */
let rkBusy = false;
let rkBoard = "world_boss";
/* Baris papan yang sedang tampil — dipakai sheet profil tanpa request tambahan. */
let rkRows = [];
const rkBoardCache = {};

const RK_BOARDS = {
  world_boss:  { label: "ETERNAL DRAGON", col: "DAMAGE", daily: true,
                 note: "World Boss · 3 attempts/day · score = best damage in 1 run · resets 00:00 WIB · rewards claimed in the WORLD BOSS hub." },
  world_boss_b:{ label: "SHADOW KING",    col: "DAMAGE", daily: true,
                 note: "Shadow King · 3 attempts/day · score = best damage in 1 run · resets 00:00 WIB · rewards claimed in the WORLD BOSS hub." },
  inf_tower:   { label: "INFINITE TOWER", col: "FLOOR", daily: false,
                 note: "Infinite Tower · score = highest floor reached · weekly reset (Monday)." },
  deck_power:  { label: "DECK POWER",     col: "POWER",  daily: false,
                 note: "Deck Power · total power of your best deck · weekly reset (Monday)." },
  rarest_pull: { label: "RAREST PULL",    col: "RARITY", daily: false,
                 note: "Rarest Pull · rarest card ever rolled · weekly reset (Monday)." }
};

function openRanking(board) {
  const m = document.getElementById("rankModal");
  if (!m) return;
  rkBoard = RK_BOARDS[board] ? board : "world_boss";
  rkSyncTabs();
  if (typeof lbTrackSweep === "function") lbTrackSweep();
  if (m.classList.contains("show")) { rkRender(); return; }
  rkRender();
  m.classList.add("show");
  document.body.classList.add("rk-open");
  rkBannerOpen();
}

function closeRanking() {
  const m = document.getElementById("rankModal");
  if (!m || !m.classList.contains("show")) return;
  closeRkProfile();
  /* Video border #1 jangan tetap muter di belakang modal (kuota + CPU player). */
  m.querySelectorAll("video").forEach(v => { try { v.pause(); } catch (e) {} });
  rkBannerClose(() => {
    m.classList.remove("show");
    document.body.classList.remove("rk-open");
  });
}
function rkSwitch(board) {
  if (!RK_BOARDS[board] || board === rkBoard) return;
  rkBoard = board;
  rkSyncTabs();
  rkRender();
}

function rkSyncTabs() {
  const tabs = document.querySelectorAll("#rkTabs .rk-tab");
  tabs.forEach(t => t.classList.toggle("on", t.dataset.rk === rkBoard));
}

function rkFmtBig(v) {
  const n = Number(v) || 0;
  const u = [[1e12, "T"], [1e9, "B"], [1e6, "M"]];
  for (const [d, s] of u) if (n >= d) return (Math.round(n / d * 100) / 100).toLocaleString("en-US") + s;
  return String(Math.round(n));
}

function rkValFmt(board, v) {
  if (board === "inf_tower") return "FLOOR " + Math.round(Number(v) || 0);
  if (board === "rarest_pull") return "1 in " + fmtChance(v);
  return rkFmtBig(v);
}

function rkSub(r, board) {
  if (board !== "rarest_pull" && board !== "inf_tower") return "";
  const m = r.meta || {};
  const t = m.name || m.card || m.tier || m.title || "";
  return t ? `<span class="rk-sub">${rkEsc(t)}</span>` : "";
}

/* ===== BORDER TOP-3 =====
   #1 = video loop (background hitam -> mix-blend-mode:screen), #2/#3 = ring PNG
   hasil keying dari asset user (background putih dibuang di canvas). */
const RK_BD1 = "assets/ui/lb-top1.mp4";
const RK_BD23 = "assets/ui/lb-ring.webp";
const RK_UNIT = { world_boss: "DMG", world_boss_b: "DMG", inf_tower: "FLOOR", deck_power: "POWER", rarest_pull: "1 IN" };

/* inf_tower ("F 187") dan rarest_pull ("1 in 2.4M") sudah membawa satuannya
   sendiri di rkValFmt, jadi chip satuan tidak perlu diulang. */
function rkUnitChip(board) {
  return (board === "inf_tower" || board === "rarest_pull") ? "" : (RK_UNIT[board] || "SCORE");
}

/* Avatar bawaan papan = art kartu lead deck (dikirim lewat meta saat submit).
   Path dibatasi whitelist supaya player lain tidak bisa menyuntik markup/URL. */
const RK_AV_PATH = /^assets\/[A-Za-z0-9._/-]+\.(webp|png|jpg|jpeg)$/;
function rkAvSrc(r) {
  const av = r && r.meta && typeof r.meta.av === "string" ? r.meta.av : "";
  return RK_AV_PATH.test(av) ? av : "";
}

/* ===== FOTO PROFIL PLAYER ASLI =====
   Foto = save_data.customAvatar (data URL, sudah dikecilkan ke 96px WebP di
   boot.js, ±3 KB). Egres Supabase dihitung dari DOWNLOAD, jadi foto tidak boleh
   ikut row leaderboard: ambil sekali per username lewat RPC bulk get_player_avatars,
   lalu simpan di cache localStorage — buka papan ke-2 kalinya biaya 0 byte. */
const RK_AV_KEY = "aab-lb-av";
const RK_AV_MAX = 150;
/* Satu-satunya bentuk yang boleh jadi <img src>: data URL gambar murni. */
const RK_DATA_IMG = /^data:image\/(webp|png|jpe?g);base64,[A-Za-z0-9+/=]{1,24000}$/;
let rkAvCache = null;

function rkAvStore() {
  if (rkAvCache) return rkAvCache;
  try { rkAvCache = JSON.parse(localStorage.getItem(RK_AV_KEY)) || {}; } catch (e) { rkAvCache = {}; }
  return rkAvCache;
}

function rkAvPersist() {
  const keys = Object.keys(rkAvCache);
  while (keys.length > RK_AV_MAX) delete rkAvCache[keys.shift()];
  try { localStorage.setItem(RK_AV_KEY, JSON.stringify(rkAvCache)); } catch (e) {}
}

function rkPhoto(username) {
  const v = rkAvStore()[String(username || "").toLowerCase()];
  return RK_DATA_IMG.test(v || "") ? v : "";
}

function rkLobbyCardSrc(r) {
  const meta = r && r.meta ? r.meta : {};
  let eqChar = meta.eqChar || (Array.isArray(meta.deck) ? meta.deck[0] : null) || (Array.isArray(meta.equipped) ? meta.equipped[0] : null);
  /* Jika baris ini adalah diri sendiri dan server belum sempat punya eqChar, ambil langsung dari kartu lobby yang sedang dipasang */
  if (!eqChar && typeof currentUser !== "undefined" && currentUser && r && String(r.username || "").toLowerCase() === String(currentUser).toLowerCase() && typeof equipped === "function") {
    try {
      const lead = equipped();
      if (lead && lead.char) eqChar = lead.char;
    } catch (e) {}
  }
  if (eqChar && typeof cardThumb === "function") {
    try {
      const csrc = cardThumb(eqChar);
      if (csrc) return csrc;
    } catch (e) {}
  }
  if (eqChar && typeof cardImg === "function") {
    try {
      const isrc = cardImg(eqChar);
      if (isrc) return isrc;
    } catch (e) {}
  }
  return rkAvSrc(r);
}

function rkFaceHtml(r, size) {
  const nm = String((r && r.username) || "?").trim();
  const ini = `<span class="rk-init"${size ? ' style="font-size:' + Math.round(size * 0.34) + 'px"' : ""}>${rkEsc((nm[0] || "?").toUpperCase())}</span>`;
  // Prioritas utama: kartu lobby yang sedang dipakai player
  const cardSrc = rkLobbyCardSrc(r);
  if (cardSrc) {
    const img = `<img class="rk-face rk-face-card" src="${rkEsc(cardSrc)}" alt="" decoding="async" onerror="this.remove()">`;
    return ini + img;
  }
  const src = rkPhoto(nm);
  const img = src ? `<img class="rk-face" src="${rkEsc(src)}" alt="" decoding="async" onerror="this.remove()">` : "";
  return ini + img;
}

/* Wajah container (data-rkav): utamakan kartu lobby (rk-face-card). Jika belum ada
   gambar sama sekali, baru isi dari fallback / foto profil. */
function rkAvPaint(scope) {
  if (!scope) return;
  scope.querySelectorAll("[data-rkav]").forEach(el => {
    const cur = el.querySelector("img.rk-face");
    if (cur && cur.classList.contains("rk-face-card")) return;
    const fb = el.getAttribute("data-rkfb") || "";
    const photo = rkPhoto(el.getAttribute("data-rkav"));
    const src = (RK_AV_PATH.test(fb) ? fb : "") || photo;
    if (!src) return;
    if (cur) {
      if (cur.getAttribute("src") === src) return;
      cur.remove();
    }
    const img = document.createElement("img");
    img.className = "rk-face rk-face-card";
    img.alt = "";
    img.decoding = "async";
    img.onerror = () => img.remove();
    img.src = src;
    el.appendChild(img);
  });
}

async function rkFillAvatars(board, rows) {
  const db = window.CloudDB;
  if (!db || typeof db.avatars !== "function") return;
  const store = rkAvStore();
  const need = [];
  for (const r of rows || []) {
    const u = String(r.username || "").toLowerCase();
    /* "" = sudah ditanyakan, player ini memang tidak punya foto (jangan tanya lagi). */
    if (u && store[u] === undefined) { store[u] = ""; need.push(u); }
  }
  if (!need.length) return;
  let got = 0;
  for (let i = 0; i < need.length; i += 80) {
    const chunk = need.slice(i, i + 80);
    let map = null;
    try { map = await db.avatars(chunk); } catch (e) {}
    if (!map) continue;
    for (const u of chunk) {
      const v = map[u] && map[u].av;
      if (RK_DATA_IMG.test(v || "")) { store[u] = v; got++; }
    }
  }
  rkAvPersist();
  if (!got || board !== rkBoard) return; /* tab pindah: DOM lama bukan milik kita */
  rkAvPaint(document.getElementById("rkBody"));
}

function rkPodFrameHtml(rank) {
  return `<div class="rk-cyber-frame rk-cf-${rank}" aria-hidden="true">
    <span class="rk-cf-aura"></span>
    <span class="rk-cf-ring rk-cf-outer"></span>
    <span class="rk-cf-ring rk-cf-inner"></span>
    <span class="rk-cf-corner tl"></span>
    <span class="rk-cf-corner tr"></span>
    <span class="rk-cf-corner bl"></span>
    <span class="rk-cf-corner br"></span>
    <span class="rk-cf-crown">${rank === 1 ? "♛ #1" : "#" + rank}</span>
  </div>`;
}

function rkPodHtml(r, board) {
  if (!r) return "";
  const rank = r.rank;
  const bd = rkPodFrameHtml(rank);
  const unit = rkUnitChip(board);
  const u = rkEsc(r.username);
  return `<div class="rk-pod rk-pod${rank}" data-u="${u}" title="View player profile">
    <div class="rk-ava">${bd}<span class="rk-ava-core" data-rkav="${u}" data-rkfb="${rkEsc(rkLobbyCardSrc(r))}">${rkFaceHtml(r, rank === 1 ? 104 : 78)}</span></div>
    <div class="rk-pod-name">${u}</div>
    <div class="rk-pod-val">${rkValFmt(board, r.value)}</div>
    ${unit ? `<div class="rk-pod-medal">${rkEsc(unit)}</div>` : ""}
  </div>`;
}

function rkPodEmptyHtml(rank, board) {
  const bd = rkPodFrameHtml(rank);
  const unit = rkUnitChip(board);
  return `<div class="rk-pod rk-pod${rank} rk-pod-empty" title="No player yet at rank #${rank}">
    <div class="rk-ava">${bd}<span class="rk-ava-core"><span class="rk-init rk-init-empty">?</span></span></div>
    <div class="rk-pod-name rk-pod-name-empty">AWAITING HUNTER</div>
    <div class="rk-pod-val rk-pod-val-empty">—</div>
    ${unit ? `<div class="rk-pod-medal">${rkEsc(unit)}</div>` : ""}
  </div>`;
}

function rkPodiumHtml(rows, board) {
  const by = {};
  for (const r of (rows || []).slice(0, 3)) by[r.rank] = r;
  /* Pod 1, 2, 3 tetap muncul dengan placeholder keren jika belum ada player */
  const slot = (r, rank) => r ? rkPodHtml(r, board) : rkPodEmptyHtml(rank, board);
  return `<div class="rk-podium">${slot(by[2], 2)}${slot(by[1], 1)}${slot(by[3], 3)}</div>`;
}

/* ===== DELTA POSISI =====
   Server cuma menyimpan skor periode berjalan, jadi selisih peringkat dihitung
   lokal dari snapshot fetch sebelumnya (per papan, per user). */
function rkDeltaStore() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem("aab-lb-delta")) || {}; } catch (e) {}
  return d;
}

function rkDeltaHtml(board, rows) {
  const store = rkDeltaStore();
  const prev = store[board] || {};
  const next = {};
  const out = {};
  for (const r of rows) {
    const k = String(r.username).toLowerCase();
    next[k] = r.rank;
    if (prev[k] == null) { out[k] = `<span class="rk-delta rk-new">NEW</span>`; continue; }
    const d = prev[k] - r.rank;
    out[k] = d > 0 ? `<span class="rk-delta up">▲${d}</span>`
      : d < 0 ? `<span class="rk-delta down">▼${-d}</span>`
      : `<span class="rk-delta same">–</span>`;
  }
  store[board] = next;
  try { localStorage.setItem("aab-lb-delta", JSON.stringify(store)); } catch (e) {}
  return out;
}

function rkRowsHtml(rows, board, delta) {
  if (!rows || !rows.length) {
    const info = RK_BOARDS[board] || RK_BOARDS.world_boss;
    let emptyRows = "";
    // Placeholder rows 4–10 keep the table looking populated before anyone shows up
    for (let i = 4; i <= 10; i++) {
      emptyRows += `<div class="rk-row rk-row-empty">
        <span class="rk-rank">${i}</span>
        <span class="rk-av-sm"><span class="rk-init" style="font-size:12px;opacity:0.4;">—</span></span>
        <span class="rk-name" style="opacity:0.4;font-style:italic;">OPEN SLOT</span>
        <span class="rk-val" style="opacity:0.4;">—</span>
        <span class="rk-delta-cell"><span class="rk-delta" style="opacity:0.3;">–</span></span>
      </div>`;
    }
    return emptyRows;
  }
  const myName = (currentUser || "").toLowerCase();
  const unit = rkUnitChip(board);
  return rows.map(r => {
    const mine = String(r.username).toLowerCase() === myName;
    const u = rkEsc(r.username);
    return `<div class="rk-row${mine ? " me" : ""}" data-u="${u}" title="View player profile">
      <span class="rk-rank rk-top${r.rank <= 3 ? r.rank : ""}">${r.rank}</span>
      <span class="rk-av-sm" data-rkav="${u}" data-rkfb="${rkEsc(rkLobbyCardSrc(r))}">${rkFaceHtml(r, 34)}</span>
      <span class="rk-name">${u}${rkSub(r, board)}</span>
      <span class="rk-val">${rkValFmt(board, r.value)}${unit ? `<em class="rk-unit">${rkEsc(unit)}</em>` : ""}</span>
      <span class="rk-delta-cell">${(delta && delta[String(r.username).toLowerCase()]) || ""}</span>
    </div>`;
  }).join("");
}

function rkEsc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function rkRender(silent) {
  const meta = document.getElementById("rkMeta");
  const body = document.getElementById("rkBody");
  if (!meta || !body) return;

  const board = rkBoard;
  const info = RK_BOARDS[board] || RK_BOARDS.world_boss;
  const canFetch = !!(window.CloudDB && typeof window.CloudDB.leaderboard === "function");

  if (!canFetch) {
    if (silent) return;
    meta.innerHTML = `<span class="rk-chip">${info.label}</span><span class="rk-chip rk-dim">OFFLINE</span><span class="rk-chip rk-bad">MODULE UNAVAILABLE</span>`;
    const emptyDelta = {};
    body.innerHTML =
      rkPodiumHtml([], board) +
      `<div class="rk-table-wrap">
        <div class="rk-head-row"><span>RANK</span><span class="rk-h-av"></span><span>PLAYER (TOP 50)</span><span>${info.col}</span><span title="Rank change vs. previous view">Δ<span class="rk-h-long"> POSITION</span></span></div>
        <div class="rk-list-scroll">${rkRowsHtml([], board, emptyDelta)}</div>
        <div class="rk-note">Offline mode · Connect to the internet to sync the global ranking.</div>
      </div>`;
    return;
  }

  if (rkBusy) return;
  rkBusy = true;
  if (!silent) {
    meta.innerHTML = `<span class="rk-chip">${info.label}</span><span class="rk-chip rk-dim">LOADING…</span>`;
    body.innerHTML = `<div class="rk-loading">LOADING RANKING…</div>`;
  }

  let res = null;
  try { res = await window.CloudDB.leaderboard(board, null, 100, currentUser || null); } catch (e) {}
  rkBusy = false;
  rkLastFetchAt = Date.now();

  /* Tab sudah pindah selama fetch -> hasil board lama jangan menimpa. */
  if (board !== rkBoard) { rkRender(silent); return; }

  if (!res || !res.ok) {
    if (silent) return; /* refresh berkala gagal: tampilan lama dibiarkan */
    meta.innerHTML = `<span class="rk-chip">${info.label}</span><span class="rk-chip rk-bad">SERVER NOT RESPONDING</span>`;
    const emptyDelta = {};
    body.innerHTML =
      rkPodiumHtml([], board) +
      `<div class="rk-table-wrap">
        <div class="rk-head-row"><span>RANK</span><span class="rk-h-av"></span><span>PLAYER (TOP 50)</span><span>${info.col}</span><span title="Rank change vs. previous view">Δ<span class="rk-h-long"> POSITION</span></span></div>
        <div class="rk-list-scroll">${rkRowsHtml([], board, emptyDelta)}</div>
        <div class="rk-note">Server did not respond · Try syncing again in a moment.</div>
      </div>`;
    return;
  }

  const me = res.me;
  meta.innerHTML =
    `<span class="rk-chip">${info.label}</span>` +
    `<span class="rk-chip">${rkEsc(res.period)}</span>` +
    `<span class="rk-chip rk-dim">${res.total_players || 0} PLAYERS</span>` +
    (currentUser
      ? (me
          ? `<span class="rk-chip rk-own">YOUR POSITION #${me.rank} · ${rkValFmt(board, me.value)}</span>`
          : `<span class="rk-chip rk-dim">NO SCORE YET</span>`)
      : `<span class="rk-chip rk-dim">SIGN IN TO RECORD SCORE</span>`);

  const keepScroll = silent ? body.scrollTop : 0;
  const oldVid = body.querySelector("video.rk-bd1");
  const delta = rkDeltaHtml(board, res.rows || []);
  /* Pod 1, 2, 3 di tengah (urutan 2 - 1 - 3). Rank 4 s/d 50 masuk ke dalam scroll list. */
  const allRows = res.rows || [];
  const topRows = allRows.slice(0, 3);
  const listRows = allRows.slice(3, 50); // Maksimal 50 player yang dicatat di list

  body.innerHTML =
    rkPodiumHtml(topRows, board) +
    `<div class="rk-table-wrap">
      <div class="rk-head-row"><span>RANK</span><span class="rk-h-av"></span><span>PLAYER (TOP 50)</span><span>${info.col}</span><span title="Rank change vs. previous view">Δ<span class="rk-h-long"> POSITION</span></span></div>
      <div class="rk-list-scroll">${rkRowsHtml(listRows, board, delta)}</div>
      <div class="rk-note">${info.note}</div>
    </div>`;
  /* Refresh berkala: pindahkan elemen video yang sudah jalan ke DOM baru, jangan
     download ulang 2,4 MB tiap menit. */
  const newVid = body.querySelector("video.rk-bd1");
  if (oldVid && newVid) newVid.replaceWith(oldVid);
  else if (newVid) newVid.play().catch(() => {});
  body.scrollTop = keepScroll;
  rkRows = res.rows || [];
  rkBoardCache[board] = rkRows;
  rkTopStat(res.period, res.total_players || 0);
  rkAvPaint(body);
  rkFillAvatars(board, rkRows);
}

/* Top bar telemetry: period + hunter count (mirrors the meta chips). */
function rkTopStat(period, players) {
  const p = document.getElementById("rkTsPeriod");
  const n = document.getElementById("rkTsPlayers");
  if (p) p.textContent = period ? String(period) : "—";
  if (n) n.textContent = String(players || 0);
}

/* ===== SUBMIT SKOR 3 PAPAN MINGGUAN =====
   Cache lokal per-user + per-minggu (kunci minggu ISO sama dengan server):
   cuma kirim kalau rekor naik, dan setelah gagal tunggu 60 dtk sebelum coba lagi. */
const LB_MIN_GAP_MS = 60000;
let lbMem = { u: "", w: "", data: {} };
let lbSending = {};
let lbOwnedMemo = { u: "", w: "", n: -1 };

function lbWeekKey() {
  const wib = new Date(Date.now() + 7 * 3600000);
  const d = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = d.getUTCFullYear();
  const jam1 = Date.UTC(y, 0, 1);
  const wk = Math.ceil(((d - jam1) / 86400000 + 1) / 7);
  return y + "-W" + (wk < 10 ? "0" + wk : wk);
}

function lbState() {
  const u = String(currentUser || "").toLowerCase();
  const w = lbWeekKey();
  if (lbMem.u !== u || lbMem.w !== w) {
    let data = {};
    try { data = JSON.parse(localStorage.getItem("aab-lb2-" + u)) || {}; } catch (e) {}
    if (data.__w !== w) data = { __w: w };
    lbMem = { u: u, w: w, data: data };
  }
  return lbMem.data;
}

function lbSaveState() {
  try { localStorage.setItem("aab-lb2-" + lbMem.u, JSON.stringify(lbMem.data)); } catch (e) {}
}

async function lbSubmit(board, value, meta) {
  value = Math.round(Number(value) || 0);
  if (!currentUser || value <= 0) return;
  if (!window.CloudDB || typeof window.CloudDB.submitScore !== "function") return;
  if (lbSending[board]) return;
  const st = lbState();
  const rec = st[board] || {};
  /* Nilai bisa dibulatkan saat bolak-balik lewat JSON server (>2^53), jadi
     pakai toleransi kecil biar sweep tidak mengirim ulang terus. */
  const tol = Math.max(0.5, value * 1e-12);
  if ((rec.v || 0) >= value - tol) return;
  if (rec.at && Date.now() - rec.at < LB_MIN_GAP_MS) return;
  lbSending[board] = true;
  let res = null;
  try { res = await window.CloudDB.submitScore(board, value, meta || {}); } catch (e) {}
  lbSending[board] = false;
  if (res && res.ok) {
    /* Simpan nilai yang BENAR-BENAR tersimpan di server (bisa ter-clamp),
       supaya kalau plafon server dinaikkan skor lama ikut terkirim ulang. */
    const stored = Number(res.value);
    st[board] = { v: Number.isFinite(stored) && stored > 0 ? stored : value };
    lbSaveState();
    const m = document.getElementById("rankModal");
    if (m && m.classList.contains("show") && rkBoard === board) rkRender();
  } else {
    st[board] = { v: rec.v || 0, at: Date.now() };
    lbSaveState();
  }
}

/* Avatar papan peringkat = art kartu lead deck (thumbnail, ±belasan KB).
   Disimpan di meta supaya server tidak perlu ikut menyimpan data kartu. */
function lbAvMeta() {
  try {
    if (typeof state === "undefined" || !state || typeof equipped !== "function") return {};
    const lead = equipped();
    const ch = lead && lead.char;
    return ch && typeof cardThumb === "function" ? { av: cardThumb(ch), eqChar: ch } : (ch ? { eqChar: ch } : {});
  } catch (e) { return {}; }
}

function lbTrackTower(floor) {
  lbSubmit("inf_tower", floor, lbAvMeta());
}

function lbTrackDeckPower() {
  if (typeof totalPower !== "function") return;
  lbSubmit("deck_power", totalPower(), lbAvMeta());
}

function lbTrackPull(charId, mut, shiny) {
  if (typeof CARDS === "undefined" || !CARDS[charId]) return;
  const m = mut || "none";
  const den = typeof effChance === "function" ? effChance(charId, m, !!shiny) : 0;
  if (!den) return;
  const nm = (typeof cardName === "function" ? cardName(charId) : (CARDS[charId].name || charId));
  const sub = nm + (shiny ? " · SHINY" : "") + (m !== "none" ? " · " + m.toUpperCase() : "");
  const meta = lbAvMeta(); meta.name = sub; meta.tier = CARDS[charId].tier;
  lbSubmit("rarest_pull", den, meta);
}

/* Rekor dari data yang SUDAH dimiliki (save lama / deck berubah / minggu baru). */
function lbTrackOwnedBest() {
  if (!state || !Array.isArray(state.stacks)) return;
  const u = String(currentUser || "").toLowerCase();
  const w = lbWeekKey();
  if (lbOwnedMemo.u === u && lbOwnedMemo.w === w && lbOwnedMemo.n === state.stacks.length) return;
  let best = null, bestCh = 0;
  for (const s of state.stacks) {
    const ch = typeof effChance === "function" ? effChance(s.char, s.mut || "none", !!s.shiny) : 0;
    if (ch > bestCh) { bestCh = ch; best = s; }
  }
  lbOwnedMemo = { u: u, w: w, n: state.stacks.length };
  if (best) lbTrackPull(best.char, best.mut, best.shiny);
}

function lbTrackSweep() {
  if (!currentUser || !state) return;
  lbTrackTower((state.tower && state.tower.best) || 0);
  lbTrackDeckPower();
  lbTrackOwnedBest();
}

/* ==========================================================================
   SHEET PROFIL PLAYER PUBLIK — dibuka dari klik baris/podium papan.
   Sumber: RPC get_player_profile (migrasi 0013) yang cuma mengembalikan field
   yang boleh dilihat orang lain: ringkasan `pub`, playSec, foto, updated_at.
   Semua isi `pub` dianggap TIDAK DIPERCAYA (dikirim player lain) -> angka
   di-clamp, string di-escape, mut/trait di-whitelist, char wajib ada di CARDS.
   ========================================================================== */
const RK_MUTS = ["none", "gold", "rainbow", "secret", "ultima"];

function rpNum(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.round(v)).toLocaleString("en-US") : "0";
}

function rpPlay(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return h > 0 ? h + "h " + m + "m" : m > 0 ? m + "m " + (s % 60) + "s" : s + "s";
}

function rpAgo(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "—";
  const mi = Math.floor(Math.max(0, Date.now() - t) / 60000);
  if (mi < 1) return "JUST NOW";
  if (mi < 60) return mi + " MIN AGO";
  const h = Math.floor(mi / 60);
  if (h < 24) return h + " HOURS AGO";
  return Math.floor(h / 24) + " DAYS AGO";
}

function rpRow(lab, val) {
  return `<div class="prof-row"><span class="prof-rl">${lab}</span><span class="prof-rv">${val}</span></div>`;
}

/* Posisi per papan diambil langsung dari server (p.ranks) + fallback rkBoardCache. */
function rpBoardRows(user, srvRanks) {
  const u = String(user || "").toLowerCase();
  const sr = (srvRanks && typeof srvRanks === "object") ? srvRanks : {};
  return Object.keys(RK_BOARDS).map(b => {
    let rankNum = null, valNum = null;
    if (sr[b] && sr[b].rank) {
      rankNum = sr[b].rank;
      valNum = sr[b].value;
    } else {
      const list = rkBoardCache[b];
      const r = list ? list.find(x => String(x.username).toLowerCase() === u) : null;
      if (r) { rankNum = r.rank; valNum = r.value; }
    }
    const badge = rankNum ? `<span class="rdz-rk on">#${rankNum}</span>` : `<span class="rdz-rk off">UNRANKED</span>`;
    const scoreTxt = rankNum ? `<b class="rdz-board-val">${rkValFmt(b, valNum)}</b>` : `<span class="rdz-board-none">NO SCORE</span>`;
    return `<div class="rdz-board ${rankNum ? "has-rk" : ""}">
      <span class="rdz-board-name">${RK_BOARDS[b].label}</span>
      <span class="rdz-board-right">${badge}${scoreTxt}</span>
    </div>`;
  }).join("");
}

function rpHtml(p) {
  const pub = (p.pub && typeof p.pub === "object") ? p.pub : {};
  const name = rkEsc(p.username || "?").toUpperCase();
  const lv = Math.max(1, Math.min(1e6, Math.round(Number(pub.lv || p.lv_raw) || 1)));
  const xpNeed = lv * 1000;
  const xp = Math.max(0, Math.min(xpNeed, Math.round(Number(pub.xp != null ? pub.xp : p.xp_raw) || 0)));
  const xpPct = Math.round(xp / xpNeed * 100);
  const title = rkEsc(String(pub.title || "HUNTER").slice(0, 28));
  const photo = RK_DATA_IMG.test(p.avatar || "") ? p.avatar : "";
  const powerVal = Math.max(0, Math.round(Number(pub.power || p.power_raw) || 0));
  const rollsVal = Math.max(0, Math.round(Number(pub.rolls != null ? pub.rolls : p.rolls_raw) || 0));
  const towerBest = Math.max(0, Math.round(Number(p.tower_best) || 0));
  const rebirthCnt = Math.max(0, Math.round(Number(p.rebirth_cnt) || 0));

  const h = (pub.hero && typeof pub.hero === "object") ? pub.hero : ((p.hero_obj && typeof p.hero_obj === "object") ? p.hero_obj : null);
  let cid = (h && typeof h.c === "string" && h.c) ? h.c : (typeof p.eq_char === "string" ? p.eq_char : "");
  const known = typeof CARDS !== "undefined" && !!CARDS[cid];
  const eq = known ? {
    char: cid,
    mut: h && RK_MUTS.indexOf(h.m) >= 0 ? h.m : "none",
    trait: h && typeof h.t === "string" && TRAIT_COLOR && TRAIT_COLOR[h.t] ? h.t : "none",
    shiny: !!(h && h.s)
  } : null;

  const rare = (pub.rare && typeof pub.rare === "object") ? pub.rare : null;
  const rareTxt = rare && rare.n
    ? rkEsc(String(rare.n).slice(0, 40)) + " <small>(1 in " + rkEsc(fmtChance(Math.max(0, Number(rare.o) || 0))) + ")</small>"
    : (known ? rkEsc(cardName(cid)) : "—");

  /* Profil di LB selalu prioritaskan art kartu lobby player */
  const face = known
    ? `<img src="${rkEsc(cardImg(cid))}" alt="" decoding="async"${CARDS[cid].pos ? ` style="object-position:${rkEsc(CARDS[cid].pos)}"` : ""}>`
    : photo
      ? `<img src="${rkEsc(photo)}" alt="" decoding="async">`
      : `<span>${rkEsc((name[0] || "?"))}</span>`;

  const cardTierTxt = known && CARDS[cid] && CARDS[cid].tier ? rkEsc(CARDS[cid].tier) : "";
  const mutTag = eq && eq.mut && eq.mut !== "none" ? `<span class="rdz-tag">${rkEsc(eq.mut.toUpperCase())}</span>` : "";
  const shinyTag = eq && eq.shiny ? `<span class="rdz-tag rdz-tag-shiny">&#10022; SHINY</span>` : "";
  const traitTag = eq && eq.trait && eq.trait !== "none" ? `<span class="rdz-tag">${rkEsc(eq.trait.toUpperCase())}</span>` : "";

  return `<div class="rdz-dossier">
    <!-- LEFT: hunter identity card -->
    <div class="rdz-ident">
      <div class="rdz-hero">
        <div class="rdz-face">
          ${face}
          ${cardTierTxt ? `<span class="rdz-tier">${cardTierTxt}</span>` : ""}
          <span class="rdz-lv">LV.${lv}</span>
        </div>
        <span class="rdz-cnr tl"></span><span class="rdz-cnr tr"></span>
        <span class="rdz-cnr bl"></span><span class="rdz-cnr br"></span>
      </div>

      <div class="prof-title-tag rdz-title-tag">
        <span class="ptt-crown"><svg width="13" height="10" viewBox="0 0 24 18" fill="none"><path d="M2 15L4 4L9 9L12 2L15 9L20 4L22 15H2Z" fill="currentColor" stroke="rgba(255,255,255,.55)" stroke-width="1.1" stroke-linejoin="round"/></svg></span>
        <span class="ptt-txt">${title}</span>
      </div>
      <div class="rdz-name">${name}</div>
      <div class="rdz-sync"><span class="rdz-dot"></span><span>SYNC: ${rpAgo(p.updated_at)}</span></div>

      <div class="rdz-xpbox">
        <div class="rdz-xp-top"><span>HUNTER EXP</span><b>${rpNum(xp)} / ${rpNum(xpNeed)} &middot; ${xpPct}%</b></div>
        <div class="rdz-xpbar"><i style="width:${xpPct}%"></i></div>
      </div>

      <div class="rdz-power">
        <span>TOTAL BATTLE POWER</span>
        <b>${rpNum(powerVal)}</b>
      </div>
    </div>

    <!-- CENTER: telemetry + leaderboard standings -->
    <div class="rdz-intel">
      <div class="rdz-box">
        <div class="rdz-h">COMBAT &amp; RNG TELEMETRY</div>
        <div class="rdz-stats">
          <div class="rdz-stat">
            <span class="rdz-stat-l">PLAY TIME</span>
            <b class="rdz-stat-v">${rpPlay(p.play)}</b>
          </div>
          <div class="rdz-stat">
            <span class="rdz-stat-l">TOTAL ROLLS</span>
            <b class="rdz-stat-v">${rpNum(rollsVal)}</b>
          </div>
          <div class="rdz-stat">
            <span class="rdz-stat-l">INF TOWER RECORD</span>
            <b class="rdz-stat-v">${towerBest > 0 ? "FLOOR " + towerBest : "FLOOR 0"}</b>
          </div>
          <div class="rdz-stat">
            <span class="rdz-stat-l">REBIRTH AWAKEN</span>
            <b class="rdz-stat-v">${rebirthCnt}&times; REBIRTH</b>
          </div>
          <div class="rdz-stat wide">
            <span class="rdz-stat-l">RAREST PULL</span>
            <b class="rdz-stat-v">${rareTxt}</b>
          </div>
        </div>
      </div>

      <div class="rdz-box">
        <div class="rdz-h">GLOBAL LEADERBOARD STANDINGS</div>
        <div class="rdz-boards">${rpBoardRows(p.username, p.ranks)}</div>
      </div>
    </div>

    <!-- RIGHT: equipped lobby unit -->
    <div class="rdz-unit">
      <div class="rdz-h">EQUIPPED LOBBY UNIT</div>
      <div class="rdz-cardwrap">${eq && typeof hubCardHtml === "function"
        ? hubCardHtml(eq, "", false)
        : '<div class="hub-center"><div class="hc-info"><div class="hc-name">No main card</div></div></div>'}</div>
      <div class="rdz-unit-meta">
        <div class="rdz-um-name">${known ? rkEsc(cardName(cid)) : "UNKNOWN UNIT"}</div>
        <div class="rdz-tags">${mutTag}${shinyTag}${traitTag}</div>
      </div>
    </div>
  </div>`;
}

let rpBusy = 0;

function openRkProfile(username) {
  const m = document.getElementById("rkProfModal");
  const body = document.getElementById("rpBody");
  if (!m || !body) return;
  const user = String(username || "").trim().slice(0, 64);
  if (!user) return;
  m.classList.add("show");
  document.body.classList.add("rkp-open");
  if (!window.CloudDB || typeof window.CloudDB.profile !== "function") {
    body.innerHTML = `<div class="rdz-empty">SERVER OFFLINE<br><span>Player profiles are only available while online.</span></div>`;
    return;
  }
  const ticket = ++rpBusy;
  body.innerHTML = `<div class="rdz-loading">LOADING PROFILE&hellip;</div>`;
  window.CloudDB.profile(user).then(res => {
    if (ticket !== rpBusy) return; /* request berikutnya sudah dimulai */
    if (!res || !res.ok) {
      body.innerHTML = `<div class="rdz-empty">PROFILE NOT FOUND<br><span>${rkEsc(res && res.msg ? res.msg : user)} has never been saved on the server.</span></div>`;
      return;
    }
    body.innerHTML = rpHtml(res);
  }).catch(() => {
    if (ticket !== rpBusy) return;
    body.innerHTML = `<div class="rdz-empty">FAILED TO LOAD<br><span>Please try opening it again in a moment.</span></div>`;
  });
}

function closeRkProfile() {
  const m = document.getElementById("rkProfModal");
  if (!m) return;
  m.classList.remove("show");
  document.body.classList.remove("rkp-open");
  rpBusy++;
}

/* Klik baris/podium -> profil player. .rk-pod-empty tidak punya data-u. */
document.addEventListener("click", e => {
  const el = e.target && e.target.closest ? e.target.closest("[data-u]") : null;
  if (!el || !el.closest("#rankModal")) return;
  const u = el.getAttribute("data-u");
  if (u) openRkProfile(u);
});
document.addEventListener("click", e => {
  if (e.target && e.target.id === "rkProfModal") closeRkProfile();
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const p = document.getElementById("rkProfModal");
  if (p && p.classList.contains("show")) { closeRkProfile(); return; }
  const m = document.getElementById("rankModal");
  if (m && m.classList.contains("show")) closeRanking();
});

/* Refresh papan selama panel terbuka, tanpa skeleton (tampilan lama tetap
   sampai data baru datang): World Boss harian 1x/menit, papan mingguan 1x/jam. */
const RK_REFRESH_DAY_MS = 60000;
const RK_REFRESH_WEEK_MS = 3600000;
let rkLastFetchAt = 0;

/* ===== banner hazard masuk/keluar (#rankCurtain, pola #indexCurtain) ===== */
let rkHzTimers = [];
/* Guards the async close: re-opening mid-animation must not be cancelled by the
   pending "remove .show" of the previous close. */
let rkSeq = 0;
function rkHzClear() { for (let i = 0; i < rkHzTimers.length; i++) clearTimeout(rkHzTimers[i]); rkHzTimers = []; }
function rkHzSetCopy(mode) {
  const kick = document.getElementById("rkHzKick"), title = document.getElementById("rkHzTitle"),
        sub = document.getElementById("rkHzSub"), foot = document.getElementById("rkHzFoot"),
        serial = document.getElementById("rkHzSerial"), water = document.getElementById("rkHzWater");
  if (serial) serial.textContent = (0x1000 + Math.floor(Math.random() * 0xefff)).toString(16).toUpperCase();
  if (mode === "open") {
    if (kick) kick.innerHTML = "// GLOBAL <b>SYNC</b>";
    if (title) title.textContent = "LEADERBOARD";
    if (water) water.textContent = "RANK";
    if (sub) sub.textContent = "GLOBAL PULSE · DAILY STANDING";
    if (foot) foot.textContent = "SYNC STANDING";
  } else {
    if (kick) kick.innerHTML = "// LINK <b>STAND BY</b>";
    if (title) title.textContent = "HOLD";
    if (water) water.textContent = "OUT";
    if (sub) sub.textContent = "STANDING DISCONNECTING · DATA SAVED";
    if (foot) foot.textContent = "CLOSE SESSION";
  }
}
function rkBannerOpen() {
  const c = document.getElementById("rankCurtain");
  if (!c) return;
  rkSeq++;
  rkHzClear(); rkHzSetCopy("open");
  c.className = ""; void c.offsetWidth;
  c.classList.add("on", "smooth", "sweep");
  rkHzTimers.push(setTimeout(() => c.classList.add("revealed"), 1080));
  rkHzTimers.push(setTimeout(() => c.classList.remove("on", "smooth", "sweep", "revealed"), 1800));
}
/* EXIT 3 fase: tirai MENUTUP -> konten disembunyikan -> tirai MEMBUKA.
   Fase 3 wajib; tanpanya layar tertahan tertutup ("banner tidak kebuka"). */
function rkBannerClose(onCovered) {
  const c = document.getElementById("rankCurtain");
  if (!c) { if (onCovered) onCovered(); return; }
  const seq = ++rkSeq;
  rkHzClear(); rkHzSetCopy("close");
  c.className = ""; c.classList.add("on", "smooth", "revealed"); void c.offsetWidth;
  c.classList.remove("revealed");
  rkHzTimers.push(setTimeout(() => { if (seq === rkSeq && onCovered) onCovered(); }, 560));
  rkHzTimers.push(setTimeout(() => { if (seq !== rkSeq) return; c.classList.add("revealed"); }, 780));
  rkHzTimers.push(setTimeout(() => { if (seq !== rkSeq) return; c.classList.remove("on", "smooth", "revealed"); }, 1560));
}

function rkTick() {
  const m = document.getElementById("rankModal");
  if (!m || !m.classList.contains("show")) return;
  const daily = !!(RK_BOARDS[rkBoard] && RK_BOARDS[rkBoard].daily);
  if (!daily && Date.now() - rkLastFetchAt < RK_REFRESH_WEEK_MS) return;
  rkRender(true);
}
setInterval(rkTick, RK_REFRESH_DAY_MS);

window.openRanking = openRanking;
window.closeRanking = closeRanking;
window.rkSwitch = rkSwitch;
window.openRkProfile = openRkProfile;
window.closeRkProfile = closeRkProfile;
window.rkBannerOpen = rkBannerOpen;
window.rkBannerClose = rkBannerClose;
