/* ==========================================================================
   LEADERBOARD — panel dari tile hub lobby.
   Data: RPC get_leaderboard (board world_boss / world_boss_b / inf_tower /
   deck_power / rarest_pull).
   ========================================================================== */
let rkBusy = false;
let rkBoard = "world_boss";

const RK_BOARDS = {
  world_boss:  { label: "ETERNAL DRAGON", col: "DAMAGE", daily: true,
                 note: "World Boss · 3 attempt/hari · skor = damage terbaik 1 run · reset 00:00 WIB · reward diklaim di hub WORLD BOSS." },
  world_boss_b:{ label: "SHADOW KING",    col: "DAMAGE", daily: true,
                 note: "Shadow King · 3 attempt/hari · skor = damage terbaik 1 run · reset 00:00 WIB · reward diklaim di hub WORLD BOSS." },
  inf_tower:   { label: "INFINITE TOWER", col: "LANTAI", daily: false,
                 note: "Infinite Tower · skor = lantai tertinggi · reset mingguan (Senin)." },
  deck_power:  { label: "DECK POWER",     col: "POWER",  daily: false,
                 note: "Deck Power · total power deck terbaik · reset mingguan (Senin)." },
  rarest_pull: { label: "RAREST PULL",    col: "RARITY", daily: false,
                 note: "Rarest Pull · kartu paling langka yang pernah di-roll · reset mingguan (Senin)." }
};

function openRanking(board) {
  const m = document.getElementById("rankModal");
  if (!m) return;
  rkBoard = RK_BOARDS[board] ? board : "world_boss";
  m.classList.add("show");
  rkSyncTabs();
  if (typeof lbTrackSweep === "function") lbTrackSweep();
  rkRender();
}

function closeRanking() {
  const m = document.getElementById("rankModal");
  if (m) m.classList.remove("show");
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
  if (board === "inf_tower") return "F " + Math.round(Number(v) || 0);
  if (board === "rarest_pull") return "1 in " + fmtChance(v);
  return rkFmtBig(v);
}

function rkSub(r, board) {
  if (board !== "rarest_pull" && board !== "inf_tower") return "";
  const m = r.meta || {};
  const t = m.name || m.card || m.tier || m.title || "";
  return t ? `<span class="rk-sub">${rkEsc(t)}</span>` : "";
}

function rkRowsHtml(rows, board) {
  if (!rows || !rows.length) {
    const info = RK_BOARDS[board] || RK_BOARDS.world_boss;
    return `<div class="rk-empty">BELUM ADA SKOR<br><span>Jadilah yang pertama masuk papan ${rkEsc(info.label)}.</span></div>`;
  }
  const myName = (currentUser || "").toLowerCase();
  return rows.map(r => {
    const mine = String(r.username).toLowerCase() === myName;
    return `<div class="rk-row${mine ? " me" : ""}">
      <span class="rk-rank rk-top${r.rank <= 3 ? r.rank : ""}">${r.rank}</span>
      <span class="rk-name">${rkEsc(r.username)}${rkSub(r, board)}</span>
      <span class="rk-val">${rkValFmt(board, r.value)}</span>
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

  const info = RK_BOARDS[rkBoard] || RK_BOARDS.world_boss;
  const online = !!(window.CloudDB && typeof window.CloudDB.leaderboard === "function" && currentUser);

  if (!online) {
    if (silent) return;
    meta.innerHTML = `<span class="rk-chip">${info.label}</span><span class="rk-chip rk-dim">LOGIN UNTUK RANKING</span>`;
    body.innerHTML = `<div class="rk-empty">TIDAK TERHUBUNG KE SERVER<br><span>Ranking hanya tersedia saat online.</span></div>`;
    return;
  }

  if (rkBusy) return;
  rkBusy = true;
  if (!silent) {
    meta.innerHTML = `<span class="rk-chip">${info.label}</span><span class="rk-chip rk-dim">MEMUAT…</span>`;
    body.innerHTML = `<div class="rk-loading">MEMUAT RANKING…</div>`;
  }

  const board = rkBoard;
  let res = null;
  try { res = await window.CloudDB.leaderboard(board, null, 100, currentUser); } catch (e) {}
  rkBusy = false;
  rkLastFetchAt = Date.now();

  /* Tab sudah pindah selama fetch -> hasil board lama jangan menimpa. */
  if (board !== rkBoard) { rkRender(silent); return; }

  if (!res || !res.ok) {
    if (silent) return; /* refresh berkala gagal: tampilan lama dibiarkan */
    meta.innerHTML = `<span class="rk-chip">${info.label}</span><span class="rk-chip rk-bad">GAGAL MEMUAT</span>`;
    body.innerHTML = `<div class="rk-empty">SERVER TIDAK MERESPONS<br><span>Coba buka lagi sebentar lagi.</span></div>`;
    return;
  }

  const me = res.me;
  meta.innerHTML =
    `<span class="rk-chip">${info.label}</span>` +
    `<span class="rk-chip">${rkEsc(res.period)}</span>` +
    `<span class="rk-chip rk-dim">${res.total_players || 0} PEMAIN</span>` +
    (me
      ? `<span class="rk-chip rk-own">POSISI KAMU #${me.rank} · ${rkValFmt(board, me.value)}</span>`
      : `<span class="rk-chip rk-dim">KAMU BELUM PUNYA SKOR</span>`);

  const keepScroll = silent ? body.scrollTop : 0;
  body.innerHTML =
    `<div class="rk-head-row"><span>RANK</span><span>PEMAIN</span><span>${info.col}</span></div>` +
    rkRowsHtml(res.rows, board) +
    `<div class="rk-note">${info.note}</div>`;
  body.scrollTop = keepScroll;
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

function lbTrackTower(floor) {
  lbSubmit("inf_tower", floor, {});
}

function lbTrackDeckPower() {
  if (typeof totalPower !== "function") return;
  lbSubmit("deck_power", totalPower(), {});
}

function lbTrackPull(charId, mut, shiny) {
  if (typeof CARDS === "undefined" || !CARDS[charId]) return;
  const m = mut || "none";
  const den = typeof effChance === "function" ? effChance(charId, m, !!shiny) : 0;
  if (!den) return;
  const nm = (typeof cardName === "function" ? cardName(charId) : (CARDS[charId].name || charId));
  const sub = nm + (shiny ? " · SHINY" : "") + (m !== "none" ? " · " + m.toUpperCase() : "");
  lbSubmit("rarest_pull", den, { name: sub, tier: CARDS[charId].tier });
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

document.addEventListener("click", e => {
  if (e.target && e.target.id === "rankModal") closeRanking();
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const m = document.getElementById("rankModal");
  if (m && m.classList.contains("show")) closeRanking();
});

/* Refresh papan selama panel terbuka, tanpa skeleton (tampilan lama tetap
   sampai data baru datang): World Boss harian 1x/menit, papan mingguan 1x/jam. */
const RK_REFRESH_DAY_MS = 60000;
const RK_REFRESH_WEEK_MS = 3600000;
let rkLastFetchAt = 0;

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
