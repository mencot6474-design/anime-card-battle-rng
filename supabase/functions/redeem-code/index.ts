/* ===========================================================
 * Edge Function: redeem-code
 * POST { username, password_hash, code }
 * -> { ok, already, gems, balance, pack_id }
 *
 * Tukar kode redeem (hasil pembelian di Trakteer Shop) menjadi Gems.
 * Auth manual: username + password hash dicocokkan dengan player_saves
 * (client game tidak punya Supabase Auth session).
 * Validasi + kredit gems dilakukan di DB lewat RPC `redeem_code`
 * (atomic + idempotent). Tidak ada service_role yang diekspos ke client.
 * =========================================================== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  json,
  normUser,
  verifyPlayer,
} from "../_shared/packs.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const body = await req.json().catch(() => ({}));
    const username = normUser(body.username);
    const passwordHash = String(body.password_hash || "");
    const code = String(body.code || "").trim().toUpperCase();

    if (!code) return json({ error: "KODE_WAJIB_DIISI" }, 400);
    if (!username || !passwordHash) return json({ error: "KREDENSIAL_KOSONG" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    /* 1) Authenticate user (username + password hash). */
    const auth = await verifyPlayer(supabase, username, passwordHash);
    if (!auth.ok) return json({ error: auth.msg || "AUTH_GAGAL" }, 401);

    /* 2) Redeem atomik via RPC (kunci = kode, idempotent). */
    const { data, error } = await supabase.rpc("redeem_code", {
      p_code: code,
      p_username: username,
      p_password_hash: passwordHash,
    });

    if (error) {
      const msg = error.message || String(error);
      const known: Record<string, [string, number]> = {
        CODE_NOT_FOUND: ["KODE_TIDAK_DITEMUKAN", 404],
        CODE_INACTIVE: ["KODE_NONAKTIF", 400],
        CODE_EXPIRED: ["KODE_KEDALUWARSA", 400],
        CODE_ALREADY_USED: ["KODE_SUDAH_DIPAKAI", 409],
        PLAYER_NOT_FOUND: ["AKUN_TIDAK_DITEMUKAN", 404],
        AUTH_FAILED: ["PASSWORD_SALAH", 401],
        BAD_INPUT: ["INPUT_TIDAK_VALID", 400],
      };
      const hit = known[msg] || known[msg.split(":")[0]];
      if (hit) return json({ error: hit[0] }, hit[1]);
      return json({ error: "REDEEM_ERROR: " + msg }, 500);
    }

    return json({
      ok: true,
      already: !!data?.already,
      gems: data?.gems ?? 0,
      balance: data?.balance ?? null,
      pack_id: data?.pack_id ?? null,
    });
  } catch (err) {
    console.error("redeem-code error", err);
    return json({ error: "SERVER_ERROR: " + (err?.message || String(err)) }, 500);
  }
});
