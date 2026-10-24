/* ==========================================================================
   LEADERBOARD — panel dari tile hub lobby.
   Data: RPC get_leaderboard (board world_boss, periode harian server).
   ========================================================================== */
let rkBusy = false;

function openRanking() {
  const m = document.getElementById("rankModal");
  if (!m) return;
  m.classList.add("show");
  rkRender();
}

function closeRanking() {
  const m = document.getElementById("rankModal");
  if (m) m.classList.remove("show");
}

function rkFmtPct(v) {
  const n = Math.round((Number(v) || 0) * 10) / 10;
  return (Number.isInteger(n) ? n : n.toFixed(1)) + "%";
}

function rkRowsHtml(rows, me) {
  if (!rows || !rows.length) {
    return `<div class="rk-empty">BELUM ADA SKOR HARI INI<br><span>Mainkan World Boss di BOSS RAID untuk masuk ranking.</span></div>`;
  }
  const myName = (currentUser || "").toLowerCase();
  return rows.map(r => {
    const mine = String(r.username).toLowerCase() === myName;
    const medal = r.rank === 1 ? "1" : r.rank === 2 ? "2" : r.rank === 3 ? "3" : String(r.rank);
    return `<div class="rk-row${mine ? " me" : ""}">
      <span class="rk-rank rk-top${r.rank <= 3 ? r.rank : ""}">${medal}</span>
      <span class="rk-name">${rkEsc(r.username)}</span>
      <span class="rk-val">${rkFmtPct(r.value)}</span>
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

  const online = !!(window.CloudDB && typeof window.CloudDB.leaderboard === "function" && currentUser);

  if (!online) {
    meta.innerHTML = `<span class="rk-chip">OFFLINE</span><span class="rk-chip rk-dim">LOGIN UNTUK RANKING</span>`;
    body.innerHTML = `<div class="rk-empty">TIDAK TERHUBUNG KE SERVER<br><span>Ranking hanya tersedia saat online.</span></div>`;
    return;
  }

  if (rkBusy) return;
  rkBusy = true;
  body.innerHTML = `<div class="rk-loading">MEMUAT RANKING…</div>`;

  let res = null;
  try { res = await window.CloudDB.leaderboard("world_boss", null, 100, currentUser); } catch (e) {}
  rkBusy = false;

  if (!res || !res.ok) {
    meta.innerHTML = `<span class="rk-chip rk-bad">GAGAL MEMUAT</span>`;
    body.innerHTML = `<div class="rk-empty">SERVER TIDAK MERESPONS<br><span>Coba buka lagi sebentar lagi.</span></div>`;
    return;
  }

  const me = res.me;
  meta.innerHTML =
    `<span class="rk-chip">${rkEsc(res.period)}</span>` +
    `<span class="rk-chip rk-dim">${res.total_players || 0} PEMAIN</span>` +
    (me
      ? `<span class="rk-chip rk-own">POSISI KAMU #${me.rank} · ${rkFmtPct(me.value)}</span>`
      : `<span class="rk-chip rk-dim">KAMU BELUM PUNYA SKOR</span>`);

  body.innerHTML =
    `<div class="rk-head-row"><span>RANK</span><span>PEMAIN</span><span>DAMAGE</span></div>` +
    rkRowsHtml(res.rows, me) +
    `<div class="rk-note">World Boss · 3 attempt/hari · reset 00:00 WIB · reward diklaim di layar BOSS RAID.</div>`;
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
