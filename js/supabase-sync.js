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

  async registerUser(username, passHash, initialSave) {
    const body = {
      username: username.toLowerCase(),
      password: passHash,
      save_data: initialSave,
      updated_at: new Date().toISOString()
    };
    return await this._request(`player_saves`, {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: JSON.stringify(body)
    });
  },

  async saveState(username, stateObj) {
    if (!username) return;
    if (window.CURRENT_DEVICE_SESSION && stateObj) {
      stateObj.current_session_id = window.CURRENT_DEVICE_SESSION;
    }
    const body = {
      save_data: stateObj,
      updated_at: new Date().toISOString()
    };
    return await this._request(`player_saves?username=eq.${encodeURIComponent(username.toLowerCase())}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify(body)
    });
  },

  async updateSession(username, sessionId) {
    if (!username) return;
    const user = await this.getUser(username);
    if (!user) return;
    const curSave = user.save_data || {};
    curSave.current_session_id = sessionId;
    if (window.state) {
      window.state.current_session_id = sessionId;
    }
    const body = {
      save_data: curSave,
      updated_at: new Date().toISOString()
    };
    return await this._request(`player_saves?username=eq.${encodeURIComponent(username.toLowerCase())}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify(body)
    });
  },

  async getPremiumBalance(username) {
    if (!username) return null;
    const user = await this.getUser(username);
    if (user && user.save_data && typeof user.save_data.premiumGems === "number") {
      return user.save_data.premiumGems;
    }
    return 0;
  },

  async verifyAndDeductGems(username, cost, packKey, itemType) {
    if (!username) {
      // Guest mode: local check
      if ((window.state?.premiumGems || 0) < cost) return { ok: false, msg: "GEMS TIDAK CUKUP" };
      window.state.premiumGems -= cost;
      if (itemType === 'weather') {
        // Cuaca langsung aktif di state lokal
      } else if (itemType === 'art') {
        window.state.artOwned = window.state.artOwned || [];
        if (!window.state.artOwned.includes(packKey)) window.state.artOwned.push(packKey);
      } else if (itemType === 'pet') {
        window.state.petOwned = window.state.petOwned || [];
        if (!window.state.petOwned.includes(packKey)) window.state.petOwned.push(packKey);
      } else {
        window.state.rollPacks = window.state.rollPacks || {};
        window.state.rollPacks[packKey] = (window.state.rollPacks[packKey] || 0) + 1;
      }
      return { ok: true, balance: window.state.premiumGems };
    }

    try {
      const user = await this.getUser(username);
      if (!user) return { ok: false, msg: "AKUN TIDAK DITEMUKAN" };
      const curSave = user.save_data || {};
      const cloudGems = typeof curSave.premiumGems === "number" ? curSave.premiumGems : (window.state?.premiumGems || 0);
      
      if (cloudGems < cost) {
        // Sync local to true cloud balance
        if (window.state) window.state.premiumGems = cloudGems;
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
        curSave.rollPacks[packKey] = (curSave.rollPacks[packKey] || 0) + 1;
      }

      // Update state locally
      if (window.state) {
        window.state.premiumGems = curSave.premiumGems;
        if (itemType === 'art') {
          window.state.artOwned = curSave.artOwned;
        } else if (itemType === 'pet') {
          window.state.petOwned = curSave.petOwned;
        } else if (itemType !== 'weather') {
          window.state.rollPacks = window.state.rollPacks || {};
          window.state.rollPacks[packKey] = curSave.rollPacks[packKey];
        }
      }

      /* Upload state LOKAL terbaru (bukan snapshot cloud lama) supaya kartu/progress terbaru tidak ter-rollback. */
      const payload = window.state ? window.state : curSave;
      const res = await this.saveState(username, payload);
      return { ok: true, balance: curSave.premiumGems };
    } catch (err) {
      console.error("[CloudDB verifyAndDeductGems fail]", err);
      return { ok: false, msg: "GAGAL MENGHUBUNGI CLOUD: " + err.message };
    }
  },

  async getSessionId(username) {
    const user = await this.getUser(username);
    if (user && user.save_data && user.save_data.current_session_id) {
      return user.save_data.current_session_id;
    }
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
  _sessionCheckInterval = setInterval(async () => {
    if (!currentUser || !window.CloudDB) return;
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
  }, 4000); // Check tiap 4 detik biar responsif
}

window.startSessionHeartbeat = startSessionHeartbeat;
window.CloudDB = CloudDB;
