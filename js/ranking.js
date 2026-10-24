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

async function rkRender() {
  const meta = document.getElementById("rkMeta");
  const body = document.getElementById("rkBody");
  if (!meta || !body) return;

  const info = RK_BOARDS[rkBoard] || RK_BOARDS.world_boss;
  const online = !!(window.CloudDB && typeof window.CloudDB.leaderboard === "function" && currentUser);

  if (!online) {
    meta.innerHTML = `<span class="rk-chip">${info.label}</span><span class="rk-chip rk-dim">LOGIN UNTUK RANKING</span>`;
    body.innerHTML = `<div class="rk-empty">TIDAK TERHUBUNG KE SERVER<br><span>Ranking hanya tersedia saat online.</span></div>`;
    return;
  }

  if (rkBusy) return;
  rkBusy = true;
  meta.innerHTML = `<span class="rk-chip">${info.label}</span><span class="rk-chip rk-dim">MEMUAT…</span>`;
  body.innerHTML = `<div class="rk-loading">MEMUAT RANKING…</div>`;

  const board = rkBoard;
  let res = null;
  try { res = await window.CloudDB.leaderboard(board, null, 100, currentUser); } catch (e) {}
  rkBusy = false;

  /* Tab sudah pindah selama fetch -> hasil board lama jangan menimpa. */
  if (board !== rkBoard) { rkRender(); return; }

  if (!res || !res.ok) {
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

  body.innerHTML =
    `<div class="rk-head-row"><span>RANK</span><span>PEMAIN</span><span>${info.col}</span></div>` +
    rkRowsHtml(res.rows, board) +
    `<div class="rk-note">${info.note}</div>`;
}

document.addEventListener("click", e => {
  if (e.target && e.target.id === "rankModal") closeRanking();
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const m = document.getElementById("rankModal");
  if (m && m.classList.contains("show")) closeRanking();
});

window.openRanking = openRanking;
window.closeRanking = closeRanking;
window.rkSwitch = rkSwitch;
