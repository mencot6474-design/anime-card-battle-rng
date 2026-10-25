/* =============== SUPABASE CLOUD SYNC =============== */
const SUPABASE_URL = "https://utfptyzpwsbqfjybiaye.supabase.co";
const SUPABASE_ANON = "sb_publishable_3hlIYVo-sjMhajrzZeru6A_J610bPoy";

const CloudDB = {
  async _request(path, options = {}) {
    try {
      const headers = {
        "apikey": SUPABASE_ANON,
        "Authorization": `Bearer ${SUPABASE_ANON}`,
        "Content-Type": "application/json",
        "Prefer": options.prefer || "return=representation",
        ...(options.headers || {})
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers
      });
      if (!res.ok) {
        const txt = await res.text();
        console.warn("[CloudDB error]", res.status, txt);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.warn("[CloudDB fetch fail]", err.message);
      return null;
    }
  },

  async getUser(username) {
    const data = await this._request(`player_saves?username=eq.${encodeURIComponent(username.toLowerCase())}&select=*`);
    if (data && data.length > 0) return data[0];
    return null;
  },

  /* Register lewat RPC definer register_player. Sejak 0014 tabel
     player_saves dikunci (anon hanya SELECT), INSERT langsung ditolak RLS,
     jadi pendaftaran HARUS lewat RPC ini. */
  async registerUser(username, passHash, initialSave) {
    if (!username) return null;
    return await this._rpc("register_player", {
      p_username: String(username).toLowerCase(),
      p_password_hash: passHash,
      p_save_data: initialSave || {}
    });
  },

  async saveState(username, stateObj, opts) {
    if (!username) return;
    const allowGemDecrease = !!(opts && opts.allowGemDecrease);
    /* skipStacks: jangan kirim inventori (stacks) tiap push — server menahan nilai lama.
       Dipakai saat auto-roll supaya payload turun dari ±110 KB ke ±2 KB. */
    const skipStacks = !!(opts && opts.skipStacks);
    if (window.CURRENT_DEVICE_SESSION && stateObj) {
      stateObj.current_session_id = window.CURRENT_DEVICE_SESSION;
    }
    /* RPC memakai salinan tanpa `stacks` supaya upload benar-benar ramping;
       fallback PATCH tetap pakai stateObj utuh (kalau server belum punya
       p_skip_stacks, mengirim tanpa stacks akan MENGHAPUS inventori di cloud). */
    const pub = opts && opts.pub;
    /* `pub` (ringkasan publik) disuntik di SEMUA jalur — fallback PATCH di bawah
       menimpa body.save_data dengan stateObj mentah, jadi pembungkusnya dipakai
       dua kali, bukan cuma sekali di awal. */
    const withPub = obj => (pub && obj) ? Object.assign({}, obj, { pub }) : obj;
    let rpcPayload = stateObj;
    if ((skipStacks || pub) && stateObj) {
      rpcPayload = Object.assign({}, stateObj);
      if (skipStacks) delete rpcPayload.stacks;
      if (pub) rpcPayload.pub = pub;
    }
    const body = {
      save_data: withPub(stateObj),
      updated_at: new Date().toISOString()
    };

    /* Prioritas: RPC merge_player_state (atomik, aman dari overwrite kredit top-up).
     * Fallback: PATCH biasa kalau RPC belum ter-deploy.
     * Catatan: saat fallback, premiumGems ditulis pakai nilai CLOUD
     * supaya client tidak bisa mengarang saldo lebih besar. */
    let usedRpc = false;
    try {
      const pw = this._localPassHash(username);
      if (pw) {
        const res = await this._rpc("merge_player_state", {
          p_username: username.toLowerCase(),
          p_password_hash: pw,
          p_save_data: rpcPayload,
          p_allow_gem_decrease: allowGemDecrease,
          p_skip_stacks: skipStacks,
        });
        if (res) {
          usedRpc = true;
          const merged = res.premiumGems;
          const ST = this._st();
          if (typeof merged === "number" && ST && ST.premiumGems !== merged) {
            ST.premiumGems = merged;
            this._paint();
          }
          return res;
        }
      }
    } catch (e) {
      console.warn("[saveState] RPC merge gagal, fallback PATCH:", e && e.message);
    }

    if (!usedRpc) {
      try {
        const user = await this.getUser(username);
        const cloudGems = user && user.save_data && typeof user.save_data.premiumGems === "number"
          ? user.save_data.premiumGems
          : (typeof stateObj.premiumGems === "number" ? stateObj.premiumGems : 0);
        stateObj.premiumGems = allowGemDecrease
          ? Math.min(stateObj.premiumGems, cloudGems)
          : cloudGems;
        body.save_data = withPub(stateObj);
      } catch (e) { /* lanjut PATCH apa adanya */ }
    }

    return await this._request(`player_saves?username=eq.${encodeURIComponent(username.toLowerCase())}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify(body)
    });
  },

  /** Panggil RPC PostgREST (fnama dengan argumen named). */
  async _rpc(fn, args) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON,
          "Authorization": `Bearer ${SUPABASE_ANON}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args || {}),
      });
      const txt = await res.text();
      if (!res.ok) {
        console.warn("[rpc fail]", fn, res.status, txt.slice(0, 200));
        return null;
      }
      try { return JSON.parse(txt); } catch (e) { return null; }
    } catch (err) {
      console.warn("[rpc error]", fn, err.message);
      return null;
    }
  },

  /** Password hash user dari localStorage (sumber login game). */
  _localPassHash(username) {
    try {
      const raw = localStorage.getItem("aab-users");
      if (!raw) return "";
      const users = JSON.parse(raw) || {};
      const rec = users[String(username).toLowerCase()];
      return rec && rec.pass ? rec.pass : "";
    } catch (e) { return ""; }
  },

  /** `state` itu `let` top-level di state.js — BUKAN properti window, jadi
      `window.state` selalu undefined dan tulisannya hilang tanpa error apa pun.
      Semua tempat yang perlu menyinkronkan saldo wajib lewat sini. */
  _st() {
    try { return (typeof state !== "undefined" && state) ? state : null; } catch (e) { return null; }
  },

  /** Saldo dari server baru terasa "hidup" kalau topbar ikut digambar ulang —
      tanpa ini angkanya berubah di cloud tapi tetap lama di layar. */
  _paint() {
    try { if (typeof renderShell === "function") renderShell(); } catch (e) {}
  },

  async updateSession(username, sessionId) {
    if (!username) return;
    const user = await this.getUser(username);
    if (!user) return;
    const curSave = user.save_data || {};
    curSave.current_session_id = sessionId;
    const ST = this._st();
    if (ST) ST.current_session_id = sessionId;
    /* Pakai saveState (RPC merge) supaya saldo gems tidak tertimpa snapshot lama. */
    return await this.saveState(username, curSave);
  },

  async getPremiumBalance(username) {
    if (!username) return null;
    const user = await this.getUser(username);
    if (user && user.save_data && typeof user.save_data.premiumGems === "number") {
      return user.save_data.premiumGems;
    }
    return 0;
  },

  /* ===== TOP-UP GEMS (Xendit) ===== */

  /** Panggil Supabase Edge Function. body = JSON payload. */
  async invokeFunction(fnName, body) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON,
          "Authorization": `Bearer ${SUPABASE_ANON}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body || {}),
      });
      const txt = await res.text();
      let data = {};
      try { data = txt ? JSON.parse(txt) : {}; } catch (e) { data = { error: txt }; }
      if (!res.ok) {
        console.warn("[invokeFunction]", fnName, res.status, data);
        return { ok: false, status: res.status, error: data.error || "HTTP " + res.status, data };
      }
      return Object.assign({ ok: true }, data);
    } catch (err) {
      console.warn("[invokeFunction fail]", fnName, err.message);
      return { ok: false, status: 0, error: "GAGAL KONEKSI: " + err.message };
    }
  },

  /** Saldo gems authoritative dari cloud. */
  async getCloudGems(username) {
    const user = await this.getUser(username);
    return user && user.save_data && typeof user.save_data.premiumGems === "number"
      ? user.save_data.premiumGems
      : null;
  },

  async verifyAndDeductGems(username, cost, packKey, itemType, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    const ST = this._st();
    if (!username) {
      // Guest mode: local check
      if (!ST || (ST.premiumGems || 0) < cost) return { ok: false, msg: "GEMS TIDAK CUKUP" };
      ST.premiumGems -= cost;
      if (itemType === 'weather') {
        // Cuaca langsung aktif di state lokal
      } else if (itemType === 'art') {
        ST.artOwned = ST.artOwned || [];
        if (!ST.artOwned.includes(packKey)) ST.artOwned.push(packKey);
      } else if (itemType === 'pet') {
        ST.petOwned = ST.petOwned || [];
        if (!ST.petOwned.includes(packKey)) ST.petOwned.push(packKey);
      } else {
        ST.rollPacks = ST.rollPacks || {};
        ST.rollPacks[packKey] = (ST.rollPacks[packKey] || 0) + qty;
      }
      return { ok: true, balance: ST.premiumGems };
    }

    try {
      const user = await this.getUser(username);
      if (!user) return { ok: false, msg: "AKUN TIDAK DITEMUKAN" };
      const curSave = user.save_data || {};
      const cloudGems = typeof curSave.premiumGems === "number" ? curSave.premiumGems : ((ST && ST.premiumGems) || 0);

      if (cloudGems < cost) {
        // Sync local to true cloud balance
        if (ST) ST.premiumGems = cloudGems;
        return { ok: false, msg: "GEMS DI CLOUD TIDAK CUKUP (" + cloudGems + " < " + cost + ")" };
      }

      curSave.premiumGems = cloudGems - cost;
      if (itemType === 'weather') {
        // weather handled by caller
      } else if (itemType === 'art') {
        curSave.artOwned = curSave.artOwned || [];
        if (!curSave.artOwned.includes(packKey)) curSave.artOwned.push(packKey);
      } else if (itemType === 'pet') {
        curSave.petOwned = curSave.petOwned || [];
        if (!curSave.petOwned.includes(packKey)) curSave.petOwned.push(packKey);
      } else {
        curSave.rollPacks = curSave.rollPacks || {};
        curSave.rollPacks[packKey] = (curSave.rollPacks[packKey] || 0) + qty;
      }

      // Update state locally
      if (ST) {
        ST.premiumGems = curSave.premiumGems;
        if (itemType === 'art') {
          ST.artOwned = curSave.artOwned;
        } else if (itemType === 'pet') {
          ST.petOwned = curSave.petOwned;
        } else if (itemType !== 'weather') {
          ST.rollPacks = ST.rollPacks || {};
          ST.rollPacks[packKey] = curSave.rollPacks[packKey];
        }
      }

      /* Upload state LOKAL terbaru (bukan snapshot cloud lama) supaya kartu/progress terbaru tidak ter-rollback.
       * Pengurangan gems dilakukan lewat RPC spend_gems (atomik, server-side). */
      const payload = ST ? ST : curSave;
      const pw = this._localPassHash(username);
      if (pw) {
        const sp = await this._rpc("spend_gems", {
          p_username: username.toLowerCase(),
          p_password_hash: pw,
          p_cost: cost,
          p_save_data: payload,
        });
        if (sp && sp.ok === false) {
          return { ok: false, msg: sp.msg || "GAGAL POTONG GEMS" };
        }
        if (sp && typeof sp.balance === "number") {
          if (ST) ST.premiumGems = sp.balance;
          this._paint();
          return { ok: true, balance: sp.balance };
        }
        // RPC tidak tersedia -> fallback ke saveState
      }
      const res = await this.saveState(username, payload, { allowGemDecrease: true });
      return { ok: true, balance: curSave.premiumGems };
    } catch (err) {
      console.error("[CloudDB verifyAndDeductGems fail]", err);
      return { ok: false, msg: "GAGAL MENGHUBUNGI CLOUD: " + err.message };
    }
  },

  /* Tambah gems dari grinding (Token INF -> Gem). WAJIB lewat server:
     merge_player_state selalu pakai saldo cloud di mode biasa, jadi
     "+gems" client-saja akan ke-wipe. RPC earn_gems menambah di server. */
  async earnGems(username, gems, saveData) {
    gems = Math.max(0, Math.floor(gems || 0));
    const ST = this._st();
    if (!gems) return { ok: false, msg: "JUMLAH GEMS TIDAK VALID" };

    if (!username) {
      if (ST) ST.premiumGems = (ST.premiumGems || 0) + gems;
      this._paint();
      return { ok: true, balance: ST ? (ST.premiumGems || 0) : gems };
    }

    try {
      const pw = this._localPassHash(username);
      if (!pw) return { ok: false, msg: "SESI LOGIN TIDAK LENGKAP" };
      const res = await this._rpc("earn_gems", {
        p_username: username.toLowerCase(),
        p_password_hash: pw,
        p_gems: gems,
        p_save_data: saveData || ST || {},
      });
      if (res && res.ok === false) return { ok: false, msg: res.msg || "GAGAL TAMBAH GEMS" };
      if (res && typeof res.balance === "number") {
        if (ST) ST.premiumGems = res.balance;
        this._paint();
        return { ok: true, balance: res.balance };
      }
      return { ok: false, msg: "RPC earn_gems BELUM TER-DEPLOY" };
    } catch (err) {
      console.error("[earnGems] fail", err);
      return { ok: false, msg: "GAGAL MENGHUBUNGI CLOUD: " + err.message };
    }
  },

  /* ===== WORLD BOSS (harian, skor & attempt di server) =====
     Semua butuh password hash lokal; tanpa itu RPC ditolak. Return null = offline
     atau RPC belum ter-deploy, jadi caller wajib cek null sebelum memakai hasil. */
  async wbState(username, boss) {
    const pw = this._localPassHash(username);
    if (!username || !pw) return null;
    const args = {
      p_username: String(username).toLowerCase(),
      p_password_hash: pw,
    };
    if (boss) args.p_boss = boss;
    return await this._rpc("world_boss_state", args);
  },

  async wbStart(username, boss) {
    const pw = this._localPassHash(username);
    if (!username || !pw) return null;
    const args = {
      p_username: String(username).toLowerCase(),
      p_password_hash: pw,
    };
    if (boss) args.p_boss = boss;
    return await this._rpc("start_world_boss_run", args);
  },

  /* dmg = damage ABSOLUT run ini (bukan persen). Server memotong pool 1T boss itu. */
  async wbSubmit(username, runId, dmg, boss) {
    const pw = this._localPassHash(username);
    if (!username || !pw) return null;
    const args = {
      p_username: String(username).toLowerCase(),
      p_password_hash: pw,
      p_dmg: Math.max(0, Math.min(1000000000000, Math.round(Number(dmg) || 0))),
      p_run_id: runId,
    };
    if (boss) args.p_boss = boss;
    return await this._rpc("submit_world_boss_run", args);
  },

  async wbClaim(username, boss) {
    const pw = this._localPassHash(username);
    if (!username || !pw) return null;
    const args = {
      p_username: String(username).toLowerCase(),
      p_password_hash: pw,
    };
    if (boss) args.p_boss = boss;
    return await this._rpc("claim_world_boss_reward", args);
  },

  /** Papan peringkat read-only (world_boss / inf_tower / deck_power / rarest_pull). */
  async leaderboard(board, period, limit, username) {
    return await this._rpc("get_leaderboard", {
      p_board: board,
      p_period: period || null,
      p_limit: limit || 100,
      p_username: username ? String(username).toLowerCase() : null,
    });
  },

  /** Foto profil player lain, banyak sekaligus (migration 0013). Client cache
      hasilnya per-username di localStorage supaya hanya sekali per player. */
  async avatars(usernames) {
    const list = (usernames || []).filter(Boolean).slice(0, 80);
    if (!list.length) return {};
    return await this._rpc("get_player_avatars", { p_usernames: list }) || {};
  },

  /** Profil publik satu player (ringkasan `pub` + foto) untuk sheet profil. */
  async profile(username) {
    if (!username) return null;
    return await this._rpc("get_player_profile", {
      p_username: String(username).toLowerCase(),
    });
  },

  /** Kirim skor papan mingguan (inf_tower / deck_power / rarest_pull).
      Server hanya menyimpan kalau nilai baru lebih tinggi. */
  async submitScore(board, value, meta) {
    const pw = this._localPassHash(currentUser);
    if (!currentUser || !pw) return null;
    return await this._rpc("submit_leaderboard_score", {
      p_username: String(currentUser).toLowerCase(),
      p_password_hash: pw,
      p_board: board,
      p_value: Math.max(0, Math.min(1e21, Math.round(Number(value) || 0))),
      p_meta: meta || {},
    });
  },

  async getSessionId(username) {
    if (!username) return null;
    /* Lightweight: hanya tarik 1 kolom JSONB current_session_id dari save_data.
       Sebelumnya panggil getUser() yang select=* → download SELURUH payload
       save_data (~10–50KB) tiap heartbeat. Dengan select=sid:save_data->>...,
       response ~50 byte. Dampak: bandwidth Supabase turun ~99% dari jalur ini. */
    const data = await this._request(
      `player_saves?username=eq.${encodeURIComponent(String(username).toLowerCase())}&select=sid:save_data->>current_session_id`
    );
    if (data && data.length > 0) return data[0].sid || null;
    return null;
  },

  // Ambil global luck yang sedang aktif (ends_at > now)
  async getGlobalLuck() {
    const now = new Date().toISOString();
    const data = await this._request(
      `global_luck?ends_at=gt.${now}&order=ends_at.desc&limit=1`
    );
    return (data && data.length > 0) ? data[0] : null;
  },

  // Stack global luck — upsert logic:
  // Jika belum ada row aktif → INSERT baru (mult=10, ends_at=now+1jam)
  // Jika sudah ada → UPDATE: mult=min(mult+10,100), ends_at=min(ends_at+1jam, now+10jam)
  async stackGlobalLuck(username) {
    const STEP_MULT = 10;
    const MAX_MULT  = 100;
    const STEP_MS   = 3600000;      // 1 jam
    const MAX_MS    = 36000000;     // 10 jam
    const now       = new Date();
    const nowISO    = now.toISOString();

    // Ambil row aktif yang ada
    const existing = await this.getGlobalLuck();

    if (!existing) {
      // INSERT baru
      const endsAt = new Date(now.getTime() + STEP_MS).toISOString();
      return await this._request('global_luck', {
        method: 'POST',
        prefer: 'return=representation',
        body: JSON.stringify({
          activated_by: username,
          activated_at: nowISO,
          ends_at: endsAt,
          multiplier: STEP_MULT
        })
      });
    } else {
      // UPDATE: stack multiplier & waktu
      const newMult = Math.min((existing.multiplier || 10) + STEP_MULT, MAX_MULT);
      const curEnd  = new Date(existing.ends_at).getTime();
      const maxEnd  = now.getTime() + MAX_MS;
      const newEnd  = new Date(Math.min(curEnd + STEP_MS, maxEnd)).toISOString();
      return await this._request(`global_luck?id=eq.${existing.id}`, {
        method: 'PATCH',
        prefer: 'return=representation',
        body: JSON.stringify({
          activated_by: username,
          ends_at: newEnd,
          multiplier: newMult
        })
      });
    }
  },

  // Alias untuk backward compat (tidak dipakai lagi tapi jaga-jaga)
  async activateGlobalLuck(username, multiplier = 10, durationMs = 3600000) {
    return this.stackGlobalLuck(username);
  }
};

// Auto-kick listener if another device logs in
let _currentSessionId = localStorage.getItem("aab_device_session") || (Math.random().toString(36).slice(2) + Date.now());
localStorage.setItem("aab_device_session", _currentSessionId);
window.CURRENT_DEVICE_SESSION = _currentSessionId;

let _sessionCheckInterval = null;
function startSessionHeartbeat(username) {
  if (_sessionCheckInterval) clearInterval(_sessionCheckInterval);
  const SESSION_HEARTBEAT_MS = 60000; /* Cek sesi 1x / menit: kickout telat 1 menit
                                        masih wajar, hemat bandwidth. */
  _sessionCheckInterval = setInterval(async () => {
    if (!currentUser || !window.CloudDB) return;
    /* Skip saat tab hidden: user gak aktif, gak perlu di-kick real-time.
       Hemat lagi ~50% buat player yang multitab / background. */
    if (document.hidden) return;
    try {
      const serverSid = await window.CloudDB.getSessionId(currentUser);
      if (serverSid && serverSid !== window.CURRENT_DEVICE_SESSION) {
        clearInterval(_sessionCheckInterval);
        localStorage.removeItem("aab-session");

        // Buat modal kick langsung di DOM
        const kickOverlay = document.createElement("div");
        kickOverlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:sans-serif;";
        kickOverlay.innerHTML = `
          <div style="background:#161b22;border:1px solid #ff4757;border-radius:16px;padding:24px;max-width:340px;text-align:center;color:#fff;box-shadow:0 10px 40px rgba(255,71,87,0.3);">
            <div style="font-size:36px;margin-bottom:8px">⚠️</div>
            <div style="font-size:18px;font-weight:800;color:#ff4757;margin-bottom:8px">SESI BERAKHIR</div>
            <div style="font-size:13px;color:#a4b0be;line-height:1.5;margin-bottom:18px">Akun kamu baru saja masuk di perangkat lain. Permainan di perangkat ini telah ditutup.</div>
            <button onclick="location.reload()" style="background:#ff4757;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer">KEMBALI KE LOGIN</button>
          </div>
        `;
        document.body.appendChild(kickOverlay);
      }
    } catch(e) {}
  }, SESSION_HEARTBEAT_MS);
}

window.startSessionHeartbeat = startSessionHeartbeat;
window.CloudDB = CloudDB;
