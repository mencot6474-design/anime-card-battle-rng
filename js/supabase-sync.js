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
    const key = String(username || "").toLowerCase();
    /* Fase 2b: save SENDIRI dibaca lewat JWT (get_my_save), bukan anon.
       Fallback anon di bawah cuma jaring transisi; dicabut saat RLS 2c. */
    if (window.CloudAuth && key) {
      const own = await window.CloudAuth.mySave(key);
      if (own) return { username: own.username, save_data: own.save_data, updated_at: own.updated_at };
    }
    const data = await this._request(`player_saves?username=eq.${encodeURIComponent(key)}&select=username,save_data,updated_at`);
    if (data && data.length > 0) return data[0];
    return null;
  },

  /** Verifikasi login lewat RPC definer check_credentials (0017).
      Anon sudah TIDAK boleh baca kolom `password`, jadi client tidak lagi
      menarik hash buat dibandingkan sendiri — server yang cek, dan hasil RPC
      cuma {ok, username, sid} (password tidak pernah keluar). */
  async checkCredentials(username, passHash) {
    if (!username || !passHash) return { ok: false, msg: "AKUN_ATAU_PASSWORD_SALAH" };
    return await this._rpc("check_credentials", {
      p_username: String(username).toLowerCase(),
      p_password_hash: passHash,
    });
  },

  /* Register lewat RPC definer register_player (0024). Butuh JWT: pemanggil
     wajib membuat sesi Auth dulu (CloudAuth.ensurePass) — server yang mengisi
     player_saves.user_id dari auth.uid(). */
  async registerUser(username, initialSave) {
    if (!username) return null;
    return await this._authRpc(username, "register_player", {
      p_username: String(username).toLowerCase(),
      p_save_data: initialSave || {}
    });
  },

  async saveState(username, stateObj, opts) {
    if (!username) return;
    const allowGemDecrease = !!(opts && opts.allowGemDecrease);
    /* skipStacks: jangan kirim inventori (stacks) tiap push — server menahan nilai lama.
       Dipakai saat auto-roll supaya payload turun dari ±110 KB ke ±2 KB. */
    const skipStacks = !!(opts && opts.skipStacks);
    /* 0025: belanja coin dikirim sebagai delta, bukan nilai absolut. Selalu
       disalin ke payload baru supaya tidak ikut tersimpan ke save_data (server
       membuangnya setelah dipakai). */
    const coinSpend = Math.max(0, Math.round(Number(opts && opts.coinSpend) || 0));
    /* 0026: XP juga dikirim sebagai delta (transient). Nilai absolut xp/level dari
       client dibuang server; `_xpGain` tidak pernah ikut tersimpan ke save_data. */
    const xpGain = Math.max(0, Math.round(Number(opts && opts.xpGain) || 0));
    /* 0027: essence rebirth juga delta transient (`_rebirthGain`), plus flag
       satu-kali `_rebirthDo` supaya server yang memotong ambang & menaikkan
       count. Nilai absolut state.rebirth dari client dibuang merge. */
    const rebirthGain = Math.max(0, Math.round(Number(opts && opts.rebirthGain) || 0));
    const rebirthDo = !!(opts && opts.rebirthDo);
    if (window.CURRENT_DEVICE_SESSION && stateObj) {
      stateObj.current_session_id = window.CURRENT_DEVICE_SESSION;
    }
    /* RPC memakai salinan tanpa `stacks` supaya upload benar-benar ramping
       (server menahan nilai lama); `pub` = ringkasan publik buat profil. */
    const pub = opts && opts.pub;
    let rpcPayload = stateObj;
    if ((skipStacks || pub || coinSpend || xpGain || rebirthGain || rebirthDo) && stateObj) {
      rpcPayload = Object.assign({}, stateObj);
      if (skipStacks) delete rpcPayload.stacks;
      if (coinSpend) rpcPayload._coinSpend = coinSpend;
      if (xpGain) rpcPayload._xpGain = xpGain;
      if (rebirthGain) rpcPayload._rebirthGain = rebirthGain;
      if (rebirthDo) rpcPayload._rebirthDo = true;
      if (pub) rpcPayload.pub = pub;
    }

    /* Satu jalur: RPC merge_player_state (0024, identitas dari auth.uid()).
       Tabel player_saves sudah tanpa policy UPDATE, jadi PATCH anon/authenticated
       pasti 401 — fallback lama dihapus supaya tidak menyamar "berhasil". */
    const res = await this._authRpc(username, "merge_player_state", {
      p_save_data: rpcPayload,
      p_allow_gem_decrease: allowGemDecrease,
      p_skip_stacks: skipStacks,
    });
    if (res) {
      const merged = res.premiumGems;
      const ST = this._st();
      if (typeof merged === "number" && ST && ST.premiumGems !== merged) {
        ST.premiumGems = merged;
        this._paint();
      }
      /* 0025: coin milik server. Setiap merge mengembalikan saldo final (setelah
         _coinSpend dipotong), jadi client selalu dikoreksi ke angka server. */
      if (typeof res.coins_balance === "number" && ST && ST.coins !== res.coins_balance) {
        ST.coins = res.coins_balance;
        this._paint();
      }
      /* 0026: token & level/xp milik server. Nilai absolut client dibuang merge,
         jadi setiap push mengoreksi state ke angka server — termasuk kedua cermin
         XP (top-level xp/playerLv dan player.exp/lv). */
      if (ST) {
        let dirty = false;
        if (typeof res.wbTokens === "number" && ST.wbTokens !== res.wbTokens) { ST.wbTokens = res.wbTokens; dirty = true; }
        if (typeof res.infTokens === "number" && ST.infTokens !== res.infTokens) { ST.infTokens = res.infTokens; dirty = true; }
        if (typeof res.playerLv === "number" && ST.playerLv !== res.playerLv) { ST.playerLv = res.playerLv; dirty = true; }
        if (typeof res.xp === "number" && ST.xp !== res.xp) { ST.xp = res.xp; dirty = true; }
        if (ST.player) {
          if (typeof res.playerLv === "number" && ST.player.lv !== res.playerLv) { ST.player.lv = res.playerLv; dirty = true; }
          if (typeof res.xp === "number" && ST.player.exp !== res.xp) { ST.player.exp = res.xp; dirty = true; }
        }
        /* 0027: rebirth milik server. Kalau server menolak/memotong (plafon
           harian, essence belum cukup), angka client dikembalikan ke server. */
        if (typeof res.rebirth_count === "number" || typeof res.rebirth_essence === "number") {
          if (!ST.rebirth || typeof ST.rebirth !== "object") ST.rebirth = { count: 0, essence: 0 };
          if (typeof res.rebirth_count === "number" && ST.rebirth.count !== res.rebirth_count) { ST.rebirth.count = res.rebirth_count; dirty = true; }
          if (typeof res.rebirth_essence === "number" && ST.rebirth.essence !== res.rebirth_essence) { ST.rebirth.essence = res.rebirth_essence; dirty = true; }
        }
        /* 0028: kepemilikan pet/artefak milik server (ledger). Item yang tidak
           dibayar sudah dibuang merge — samakan state lokal supaya tidak ada
           "item hantu" yang tetap tampil sampai reload. */
        if (Array.isArray(res.petOwned) && JSON.stringify(ST.petOwned) !== JSON.stringify(res.petOwned)) {
          ST.petOwned = res.petOwned; dirty = true;
        }
        if (Array.isArray(res.artOwned) && JSON.stringify(ST.artOwned) !== JSON.stringify(res.artOwned)) {
          ST.artOwned = res.artOwned; dirty = true;
        }
        if (res.petEquipped !== undefined && (ST.petEquipped || null) !== (res.petEquipped || null)) {
          ST.petEquipped = res.petEquipped || null; dirty = true;
        }
        if (Array.isArray(res.artSlots) && JSON.stringify(ST.artSlots) !== JSON.stringify(res.artSlots)) {
          ST.artSlots = res.artSlots; dirty = true;
        }
        /* 0029: pack instan, cuaca, dan stok potion milik server. Nilai yang
           diinspect lewat F12 sudah di-nol-kan merge, jadi state lokal ikut
           dikoreksi (kalau tidak, item "hantu" tetap tampil sampai reload). */
        if (res.rollPacks && typeof res.rollPacks === "object" && JSON.stringify(ST.rollPacks) !== JSON.stringify(res.rollPacks)) {
          ST.rollPacks = res.rollPacks; dirty = true;
        }
        if (res.weather !== undefined && JSON.stringify(ST.weather || null) !== JSON.stringify(res.weather || null)) {
          ST.weather = res.weather || null; dirty = true;
        }
        if (typeof res.potions === "number" && ST.potions !== res.potions) { ST.potions = res.potions; dirty = true; }
        if (typeof res.mythicPotions === "number" && ST.mythicPotions !== res.mythicPotions) { ST.mythicPotions = res.mythicPotions; dirty = true; }
        if (Array.isArray(res.luckPots) && JSON.stringify(ST.luckPots) !== JSON.stringify(res.luckPots)) { ST.luckPots = res.luckPots; dirty = true; }
        if (Array.isArray(res.speedPots) && JSON.stringify(ST.speedPots) !== JSON.stringify(res.speedPots)) { ST.speedPots = res.speedPots; dirty = true; }
        if (dirty) this._paint();
      }
      /* 0028: penalti coin. Server menolak/menghapus percobaan tulis coin atau
         item tanpa bayar, jadi pemain tahu kenapa saldonya jadi 0. */
      if (res.penalty) {
        try {
          const why = res.penalty === "ITEM_NOT_PAID"
            ? "ITEM TANPA BAYAR · COIN DI-RESET 0"
            : "COIN TIDAK SAH · SALDO DI-RESET 0";
          if (typeof toast === "function") toast("PELANGGARAN TERDETEKSI", why, "#f87171");
        } catch (e) {}
      }
      /* 0029: nilai save yang tidak sah (pack, cuaca, potion, progres, profil,
         XP delta, klaim hadiah) sudah di-nol-kan server. Beri tahu pemain field
         mana yang kena supaya tidak dikira bug. */
      if (Array.isArray(res.tamper) && res.tamper.length) {
        try {
          const fields = Array.from(new Set(res.tamper.map(t => t && t.field).filter(Boolean))).slice(0, 4);
          if (typeof toast === "function") {
            toast("PELANGGARAN TERDETEKSI", "NILAI TIDAK SAH DI-NOL-KAN · " + fields.join(", "), "#f87171");
          }
        } catch (e) {}
      }
    }
    return res;
  },

  /** RPC tulis Fase 3 (0024): identitas SATU-SATUNYA dari JWT. Server membaca
      player_saves.user_id = auth.uid(), jadi tidak ada lagi username/hash di
      parameter. Akun lama yang barisnya belum punya user_id ditautkan dulu
      (link_player_auth) sebelum menulis; kalau tautan gagal, jangan diulang
      tiap save (cukup sekali per halaman). */
  async _authRpc(username, fn, args) {
    if (!window.CloudAuth) return null;
    const key = String(username || "").toLowerCase();
    if (!key) return null;
    let s = await window.CloudAuth._fresh(key);
    if (!s) {
      await window.CloudAuth.kick(key);
      s = await window.CloudAuth._fresh(key);
    }
    if (!s) return null;
    if (!window.CloudAuth._linked[key] && !window.CloudAuth._linkFailed[key]) {
      const lr = await window.CloudAuth.link(key).catch(() => null);
      if (lr && lr.ok) window.CloudAuth._linked[key] = true;
      else window.CloudAuth._linkFailed[key] = true;
    }
    return await window.CloudAuth._rpcJwt(fn, args || {}, s.at);
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
    /* 0029: pack instan dibeli lewat RPC `buy_pack` — harga & jumlah pack
       ditentukan server (`pack_def` + `player_packs`). Jalur spend_gems tetap
       dipakai untuk pet/artefak/cuaca. */
    if (username && itemType === "pack" && typeof this.buyPack === "function") {
      const bp = await this.buyPack(username, packKey, qty);
      if (!bp || !bp.ok) return { ok: false, msg: (bp && bp.msg) || "GAGAL BELI PACK" };
      return { ok: true, balance: bp.balance };
    }
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
       * Pengurangan gems dilakukan lewat RPC spend_gems (atomik, server-side, 0024). */
      const payload = ST ? ST : curSave;
      const sp = await this._authRpc(username, "spend_gems", {
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
      const res = await this.saveState(username, payload, { allowGemDecrease: true });
      return { ok: true, balance: curSave.premiumGems };
    } catch (err) {
      console.error("[CloudDB verifyAndDeductGems fail]", err);
      return { ok: false, msg: "GAGAL MENGHUBUNGI CLOUD: " + err.message };
    }
  },

  /* ===== GEM (0023): semua klaim per-aksi, nominal dihitung server =====
     Client cuma menyebut AKSI (stage/bab mana, source token mana). Server
     yang tahu nominalnya (tabel gem_story_*), jadi tidak ada parameter gem
     yang bisa dimanipulasi lewat console. */
  async _gemRpc(username, fn, args) {
    if (!window.CloudAuth) return { ok: false, msg: "SESI LOGIN TIDAK LENGKAP" };
    const key = String(username || "").toLowerCase();
    if (!key) return { ok: false, msg: "SESI LOGIN TIDAK LENGKAP" };
    let sess = await window.CloudAuth._fresh(key);
    if (!sess) {
      await window.CloudAuth.kick(key);
      sess = await window.CloudAuth._fresh(key);
    }
    if (!sess) return { ok: false, msg: "SESI LOGIN TIDAK LENGKAP" };
    const res = await window.CloudAuth._rpcJwt(fn, args || {}, sess.at);
    if (!res) return { ok: false, msg: "GAGAL MENGHUBUNGI CLOUD" };
    const ST = this._st();
    if (res.ok && typeof res.balance === "number" && ST) {
      ST.premiumGems = res.balance;
      this._paint();
    }
    /* 0025: claim_daily_gem juga membayar coin, jadi saldo coin ikut dikoreksi. */
    if (res.ok && typeof res.coins_balance === "number" && ST && ST.coins !== res.coins_balance) {
      ST.coins = res.coins_balance;
      this._paint();
    }
    return res;
  },

  claimStoryGem(username, no, diff, kind) {
    return this._gemRpc(username, "claim_story_gem", { p_no: no, p_diff: diff, p_kind: kind });
  },

  claimStoryReplay(username, lv, diff) {
    return this._gemRpc(username, "claim_story_replay", { p_lv: lv, p_diff: diff });
  },

  claimDailyGem(username) {
    return this._gemRpc(username, "claim_daily_gem", {});
  },

  exchangeTokens(username, source) {
    return this._gemRpc(username, "exchange_tokens", { p_source: source });
  },

  /* ===== COIN (0025) =====
     Penambahan coin hanya lewat RPC di server; client tidak pernah boleh menaikkan
     sendiri (merge menahan nilai absolut client). Semua RPC mengembalikan
     `coins_balance` = saldo final, jadi helper ini sekalian mengoreksi state. */
  async _coinRpc(username, fn, args) {
    const res = await this._authRpc(username, fn, args || {});
    if (!res) return null;
    if (res.ok && typeof res.coins_balance === "number") {
      const ST = this._st();
      if (ST) { ST.coins = res.coins_balance; this._paint(); }
    }
    return res;
  },

  claimStoryCoins(username, lv, diff) {
    return this._coinRpc(username, "claim_story_coins", { p_lv: lv, p_diff: diff });
  },

  claimTowerCoins(username, floor) {
    return this._coinRpc(username, "claim_tower_coins", { p_floor: floor });
  },

  buyWbCoins(username) {
    return this._coinRpc(username, "buy_wb_coins", {});
  },

  /* ===== BELI ITEM (0028) =====
     Pet/artefak berbayar coin TIDAK boleh dibeli lokal: dulu F12 cukup menulis
     state.coins lalu bpBuyArt/bpBuyPet, dan item-nya ikut tersimpan. Sekarang
     harga diambil dari tabel server (`item_def`), saldo dipotong + kepemilikan
     dicatat atomik di RPC `buy_item`. Respons membawa saldo & daftar item final
     sehingga state lokal langsung dikoreksi. */
  async buyItem(username, itemId) {
    if (!username || !itemId) return { ok: false, msg: "BAD_INPUT" };
    const res = await this._authRpc(username, "buy_item", { p_item_id: String(itemId) });
    if (!res) return { ok: false, msg: "GAGAL MENGHUBUNGI CLOUD" };
    const ST = this._st();
    if (ST) {
      let dirty = false;
      if (typeof res.coins_balance === "number" && ST.coins !== res.coins_balance) { ST.coins = res.coins_balance; dirty = true; }
      if (typeof res.premiumGems === "number" && ST.premiumGems !== res.premiumGems) { ST.premiumGems = res.premiumGems; dirty = true; }
      if (Array.isArray(res.petOwned) && JSON.stringify(ST.petOwned) !== JSON.stringify(res.petOwned)) { ST.petOwned = res.petOwned; dirty = true; }
      if (Array.isArray(res.artOwned) && JSON.stringify(ST.artOwned) !== JSON.stringify(res.artOwned)) { ST.artOwned = res.artOwned; dirty = true; }
      if (dirty) this._paint();
    }
    return res;
  },

  /* ===== BELI PACK INSTAN (0029) =====
     Jumlah pack instan sekarang milik server (`player_packs`). Harga diambil
     dari tabel `pack_def`, jadi F12 yang menulis state.rollPacks = 9999 tidak
     menghasilkan apa pun: merge berikutnya membangun ulang rollPacks dari
     ledger + jatah klaim tower/World Boss, kelebihannya di-nol-kan. */
  async buyPack(username, packId, qty) {
    if (!username || !packId) return { ok: false, msg: "BAD_INPUT" };
    const n = Math.max(1, Math.min(25, parseInt(qty, 10) || 1));
    const res = await this._authRpc(username, "buy_pack", { p_pack: String(packId), p_qty: n });
    if (!res) return { ok: false, msg: "GAGAL MENGHUBUNGI CLOUD" };
    const ST = this._st();
    if (ST && res.ok) {
      let dirty = false;
      if (typeof res.balance === "number" && ST.premiumGems !== res.balance) { ST.premiumGems = res.balance; dirty = true; }
      if (res.rollPacks && typeof res.rollPacks === "object") { ST.rollPacks = res.rollPacks; dirty = true; }
      if (dirty) this._paint();
    }
    return res;
  },

  /* ===== TOKEN WB/INF (0026) =====
     Saldo token hanya berubah di server. Belanja memakai harga dari tabel
     `token_shop_price` (bukan angka dari client), dan klaim lantai memakai
     nominal tetap. Semua RPC mengembalikan saldo final → state dikoreksi. */
  async _tokenRpc(username, fn, args) {
    const res = await this._authRpc(username, fn, args || {});
    if (!res) return null;
    if (res.ok) {
      const ST = this._st();
      if (ST) {
        let dirty = false;
        if (typeof res.wbTokens === "number" && ST.wbTokens !== res.wbTokens) { ST.wbTokens = res.wbTokens; dirty = true; }
        if (typeof res.infTokens === "number" && ST.infTokens !== res.infTokens) { ST.infTokens = res.infTokens; dirty = true; }
        if (dirty) this._paint();
      }
    }
    return res;
  },

  spendTokens(username, source, item) {
    return this._tokenRpc(username, "spend_tokens", { p_source: source, p_item: item });
  },

  claimTowerTokens(username, floor) {
    return this._tokenRpc(username, "claim_tower_tokens", { p_floor: floor });
  },

  /* ===== WORLD BOSS (harian, skor & attempt di server) =====
     Sejak 0024 identitas dari JWT; return null = offline / sesi belum siap,
     jadi caller wajib cek null sebelum memakai hasil. */
  async wbState(username, boss) {
    if (!username) return null;
    const args = {};
    if (boss) args.p_boss = boss;
    return await this._authRpc(username, "world_boss_state", args);
  },

  async wbStart(username, boss) {
    if (!username) return null;
    const args = {};
    if (boss) args.p_boss = boss;
    return await this._authRpc(username, "start_world_boss_run", args);
  },

  /* dmg = damage ABSOLUT run ini (bukan persen, tanpa pengali). Server memotong
     pool 10B boss itu dan membatasinya ke _wb_dmg_cap(save) di server. */
  async wbSubmit(username, runId, dmg, boss) {
    if (!username) return null;
    const args = {
      p_dmg: Math.max(0, Math.min(10000000000, Math.round(Number(dmg) || 0))),
      p_run_id: runId,
    };
    if (boss) args.p_boss = boss;
    return await this._authRpc(username, "submit_world_boss_run", args);
  },

  async wbClaim(username, boss) {
    if (!username) return null;
    const args = {};
    if (boss) args.p_boss = boss;
    return await this._authRpc(username, "claim_world_boss_reward", args);
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
    if (!currentUser) return null;
    return await this._authRpc(currentUser, "submit_leaderboard_score", {
      p_board: board,
      p_value: Math.max(0, Math.min(1e21, Math.round(Number(value) || 0))),
      p_meta: meta || {},
    });
  },

  async getSessionId(username) {
    if (!username) return null;
    /* Fase 2b: heartbeat lewat JWT (RPC 0020), tetap ±50 byte. Fallback anon
       hanya masa transisi sebelum RLS owner-only (2c). */
    if (window.CloudAuth) {
      const sid = await window.CloudAuth.mySessionId(String(username).toLowerCase());
      if (sid !== null && sid !== undefined) return sid || null;
    }
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

  /* Beli global luck lewat RPC atomik (server potong gem + stack buff).
     Bukan tulis tabel global_luck langsung lagi — lihat migration 0016.
     Return: { ok, balance, cost, multiplier, ends_at, activated_by }
     atau { ok:false, msg }. */
  async buyGlobalLuck(username) {
    if (!username) return null;
    return await this._authRpc(username, "buy_global_luck", {});
  },

  /* RPC GUARD (0032): status "bom" + eksekusi reset.
     `guard_status` selalu diizinkan walau akun sedang dikunci; RPC tulis lain
     dibalas 403 GUARD_PENDING oleh pre-request hook sampai `guard_nuke` jalan. */
  async guardStatus(username) {
    if (!username) return null;
    return await this._authRpc(username, "guard_status", {});
  },

  async guardNuke(username) {
    if (!username) return null;
    return await this._authRpc(username, "guard_nuke", { p_signal: "login" });
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

/* =============== SUPABASE AUTH (JWT) — FASE 1–3 ===============
   Tujuan: tiap login/register punya sesi Auth (auth.uid()) dan SEMUA RPC tulis
   memakai token itu sebagai identitas (0024). Username & password hash tidak
   lagi dikirim sebagai "kunci" — hash hanya dipakai untuk signIn Auth dan
   menautkan baris save lama (link_player_auth).

   Kenapa email sintetis: Supabase Auth menuntut email/telepon, game ini
   username. `username@game.invalid` (RFC2606) mustahil dikirimi email.
   Password Auth = turunan hash password lokal, BUKAN password asli —
   hashPass hanya ~7 karakter dan Supabase menuntut minimal 6.
   Semua kegagalan di sini sengaja ditelan: login lama tidak boleh ikut mati. */
const AUTH_SESS_KEY = "aab-auth-sess";
const CloudAuth = {
  _k(u) { return String(u || "").toLowerCase(); },
  _email(u) { return this._k(u) + "@game.invalid"; },
  _pass(u) { return this._apw(CloudDB._localPassHash(u)); },
  _apw(hash) { return hash ? "acb_" + hash + "_v1" : ""; },
  _all() { try { return JSON.parse(localStorage.getItem(AUTH_SESS_KEY)) || {}; } catch (e) { return {}; } },
  _store(u, d) {
    if (!d || !d.access_token) return null;
    const rec = {
      uid: (d.user && d.user.id) || "",
      at: d.access_token,
      rt: d.refresh_token || "",
      exp: Date.now() + ((d.expires_in || 3600) * 1000) - 60000,
    };
    const all = this._all();
    all[this._k(u)] = rec;
    try { localStorage.setItem(AUTH_SESS_KEY, JSON.stringify(all)); } catch (e) {}
    return rec;
  },
  session(u) { const s = this._all()[this._k(u)]; return s && s.at ? s : null; },
  /** Token buat header Authorization; null kalau belum ada / kedaluwarsa. */
  token(u) { const s = this.session(u); return s && s.exp > Date.now() ? s.at : null; },
  async _post(path, body) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data: data || {} };
  },
  async refresh(u) {
    const s = this.session(u);
    if (!s || !s.rt) return null;
    const r = await this._post("token?grant_type=refresh_token", { refresh_token: s.rt });
    return r.ok ? this._store(u, r.data) : null;
  },
  /** Sesi yang masih layak dipakai; refresh otomatis kalau access token basi. */
  async _fresh(u) {
    const k = this._k(u);
    const s = this.session(k);
    if (!s) return null;
    if (s.exp > Date.now()) return s;
    return await this.refresh(k);
  },
  async _rpcJwt(fn, args, tok) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify(args || {}),
      });
      const txt = await res.text();
      if (!res.ok) return null;
      try { return JSON.parse(txt); } catch (e) { return null; }
    } catch (e) { return null; }
  },
  /** Save MILIK PEMILIK TOKEN (RPC 0020), bukan baca anon. null = tak ada. */
  async mySave(u) {
    const s = await this._fresh(u);
    if (!s) return null;
    const d = await this._rpcJwt("get_my_save", {}, s.at);
    return d && d.ok ? d : null;
  },
  async mySessionId(u) {
    const s = await this._fresh(u);
    if (!s) return null;
    return await this._rpcJwt("get_my_session_id", {}, s.at);
  },
  /** Login cepat: bukti password = signIn Auth, save dibaca lewat JWT. */
  async authenticate(u, passH) {
    const key = this._k(u);
    if (!key || !passH) return { ok: false, reason: "no_pass" };
    const r = await this._post("token?grant_type=password", { email: this._email(key), password: this._apw(passH) });
    if (!r.ok) return { ok: false, reason: "no_auth" };
    this._store(key, r.data);
    const sv = await this.mySave(key);
    if (!sv) return { ok: false, reason: "no_save" };
    this._linked[key] = true;
    return { ok: true, username: sv.username, save_data: sv.save_data, updated_at: sv.updated_at };
  },
  /** Akun lama: hash sudah diverifikasi server (check_credentials) -> buat
      sesi Auth, tautkan uid, lalu save-nya bisa dibaca lewat JWT. */
  async connect(u, passH) {
    const key = this._k(u);
    if (!key || !passH) return { ok: false, reason: "no_pass" };
    let s = this.session(key);
    if (!s || s.exp <= Date.now()) {
      let r = await this._post("token?grant_type=password", { email: this._email(key), password: this._apw(passH) });
      if (!r.ok) {
        if (await this._confirmOn()) return { ok: false, reason: "confirm_email_on" };
        r = await this._post("signup", { email: this._email(key), password: this._apw(passH) });
        if (!r.ok) return { ok: false, reason: "rejected" };
        if (!r.data.access_token) return { ok: false, reason: "no_session" };
      }
      this._store(key, r.data);
      s = this.session(key);
    }
    const lr = await this.link(key).catch(() => null);
    if (lr && lr.ok) this._linked[key] = true;
    return { ok: true, uid: (s || {}).uid || "", link: lr ? (lr.ok ? "ok" : (lr.msg || lr.reason)) : "err" };
  },
  /** Confirm email ON = signUp balas user tanpa sesi. Akun seperti itu tak
      mungkin dikonfirmasi (email `.invalid`), jadi jangan pernah dibuat.
      Cache-nya per page-load saja, supaya toggle yang baru diubah langsung kebaca. */
  async _confirmOn() {
    if (this._confirmCfg !== null) return this._confirmCfg;
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON } });
      const d = await res.json();
      this._confirmCfg = d.mailer_autoconfirm !== true;
    } catch (e) { this._confirmCfg = true; }
    return this._confirmCfg;
  },
  _confirmCfg: null,
  /** Pastikan user punya sesi Auth. Idempoten, aman dipanggil berkali-kali. */
  async ensure(u) {
    const key = this._k(u);
    if (!key || !this._pass(key)) return { ok: false, reason: "no_local_pass" };
    const s = this.session(key);
    if (s && s.exp > Date.now()) return { ok: true, uid: s.uid };
    if (s && s.rt) {
      const r = await this.refresh(key);
      if (r) return { ok: true, uid: r.uid };
    }
    if (await this._confirmOn()) return { ok: false, reason: "confirm_email_on" };
    let r = await this._post("token?grant_type=password", { email: this._email(key), password: this._pass(key) });
    if (r.ok) return { ok: true, uid: (this._store(key, r.data) || {}).uid || "" };
    /* Belum punya akun Auth (login lama hanya bikin baris player_saves). */
    r = await this._post("signup", { email: this._email(key), password: this._pass(key) });
    if (r.ok) {
      if (r.data.access_token) return { ok: true, uid: (this._store(key, r.data) || {}).uid || "" };
      /* Jaring kedua: guard di atas bisa saja basi (toggle baru diubah). */
      console.warn("[CloudAuth] akun Auth dibuat tanpa sesi — Confirm email kembali ON?");
      return { ok: false, reason: "no_session" };
    }
    const msg = r.data.msg || r.data.error_description || r.data.message || "";
    console.warn("[CloudAuth] gagal:", r.status, msg);
    return { ok: false, reason: "rejected" };
  },
  /** Seperti ensure(), tapi password hash dikirim eksplisit. Dipakai saat
      REGISTER: users[key] belum ditulis ke localStorage, jadi ensure() tidak
      bisa menemukan hash-nya. Urutan: sesi → refresh → signIn → signUp. */
  async ensurePass(u, passH) {
    const key = this._k(u);
    if (!key || !passH) return { ok: false, reason: "no_pass" };
    const s = this.session(key);
    if (s && s.exp > Date.now()) return { ok: true, uid: s.uid };
    if (s && s.rt) {
      const r = await this.refresh(key);
      if (r) return { ok: true, uid: r.uid };
    }
    if (await this._confirmOn()) return { ok: false, reason: "confirm_email_on" };
    let r = await this._post("token?grant_type=password", { email: this._email(key), password: this._apw(passH) });
    if (!r.ok) r = await this._post("signup", { email: this._email(key), password: this._apw(passH) });
    if (r.ok && r.data && r.data.access_token) {
      const rec = this._store(key, r.data);
      return { ok: true, uid: (rec || {}).uid || "" };
    }
    return { ok: false, reason: "rejected" };
  },
  _inflight: {},
  _linked: {},
  _linkFailed: {},
  /** Tautkan baris save lama (user_id NULL) ke uid sesi ini. Butuh migration
      0019; kalau belum ada, cukup diperingatkan sekali (tidak fatal). */
  async link(u) {
    const key = this._k(u);
    const s = this.session(key);
    const ph = CloudDB._localPassHash(key);
    if (!s || !s.uid || !ph) return { ok: false, reason: "no_session" };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/link_player_auth`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${s.at}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_username: key, p_password_hash: ph }),
    });
    let d = null;
    try { d = await res.json(); } catch (e) {}
    if (!res.ok) {
      if (!this._linkWarned) {
        this._linkWarned = true;
        console.warn("[CloudAuth] link_player_auth gagal", res.status, (d && (d.message || d.msg)) || "");
      }
      return { ok: false, reason: "rpc_" + res.status };
    }
    return d || { ok: false, reason: "empty" };
  },
  _linkWarned: false,
  /** Versi tembak-lari untuk dipanggil setelah login sukses; tak pernah melempar. */
  kick(u) {
    const key = this._k(u);
    if (this._inflight[key]) return this._inflight[key];
    const p = this.ensure(key)
      .then(async r => {
        if (r && r.ok && r.uid && !this._linked[key]) {
          const lr = await this.link(key).catch(() => null);
          if (lr && lr.ok) this._linked[key] = true;
          return Object.assign({}, r, { link: lr ? (lr.ok ? "ok" : (lr.msg || lr.reason)) : "err" });
        }
        return r;
      })
      .catch(e => { console.warn("[CloudAuth] err", e && e.message); return { ok: false }; })
      .then(r => { delete this._inflight[key]; return r; });
    this._inflight[key] = p;
    return p;
  },
};
window.CloudAuth = CloudAuth;
