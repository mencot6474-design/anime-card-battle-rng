/* ===========================================================
 * Edge Function: trakteer-webhook
 * POST <payload transaksi Trakteer Shop>
 * -> { ok, already, gems, balance, transaction_id }
 *
 * Webhook ini dipanggil Trakteer (trakteer.id) ketika ada transaksi
 * yang sudah dibayar. Gems dikreditkan otomatis ke akun pembeli.
 *
 * WAJIB:
 *  - Header `x-webhook-token` harus cocok dengan env TRAKTEER_WEBHOOK_TOKEN.
 *  - Idempoten: kunci = transaction_id. Transaksi duplikat tidak
 *    menyebabkan kredit gems dua kali (dicek di RPC settle_trakteer_transaction).
 *
 * Env yang dibutuhkan:
 *  - TRAKTEER_WEBHOOK_TOKEN  (token rahasia buatan sendiri)
 *  - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (otomatis dari Supabase)
 * =========================================================== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  json,
  normUser,
  getPackByAmountIdr,
  VALID_AMOUNTS_IDR,
} from "../_shared/packs.ts";

/** Ambil nilai dari beberapa kemungkinan nama field. */
function pick(obj: any, keys: string[]): any {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/** Normalisasi nominal ke angka (menerima "10.000", "Rp10.000", 10000). */
function toNumber(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    /* 1) Verifikasi token webhook. */
    const expected = Deno.env.get("TRAKTEER_WEBHOOK_TOKEN") || "";
    if (!expected) {
      return json({ error: "WEBHOOK_TOKEN_BELUM_DISET" }, 500);
    }
    const provided = String(req.headers.get("x-webhook-token") || "");
    if (provided !== expected) {
      return json({ error: "TOKEN_TIDAK_VALID" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const data = body?.data && typeof body.data === "object" ? body.data : body;

    /* 2) Ambil field penting (nama field Trakteer bisa berbeda2). */
    const transactionId = String(
      pick(data, ["transaction_id", "transactionId", "trx_id", "order_id", "id"]) || "",
    ).trim();
    if (!transactionId) return json({ error: "TRANSACTION_ID_WAJIB" }, 400);

    const username = normUser(
      String(pick(data, ["username", "buyer_username", "buyerUsername", "customer_username", "user"]) || ""),
    );
    if (!username) return json({ error: "USERNAME_TIDAK_DITEMUKAN" }, 400);

    const amount = toNumber(pick(data, ["amount", "total", "total_price", "price", "order_total"]));
    if (amount === null) return json({ error: "AMOUNT_TIDAK_DITEMUKAN" }, 400);

    const productId = String(pick(data, ["product_id", "productId", "product", "product_name"]) || "") || null;

    /* 3) Harga & gems SELALU dari server (packs.ts), bukan dari payload. */
    const pack = getPackByAmountIdr(amount);
    if (!pack) {
      return json({
        error: "NOMINAL_TIDAK_DIKETAHUI",
        amount,
        valid_amounts: VALID_AMOUNTS_IDR,
      }, 400);
    }

    /* 4) Settlement idempotent (kunci = transaction_id). */
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: res, error } = await supabase.rpc("settle_trakteer_transaction", {
      p_transaction_id: transactionId,
      p_username: username,
      p_pack_id: pack.id,
      p_gems: pack.gems,
      p_amount_idr: pack.amountIdr,
      p_product_id: productId,
      p_raw: body,
    });

    if (error) {
      const msg = error.message || String(error);
      if (msg.startsWith("PLAYER_NOT_FOUND")) {
        return json({ error: "AKUN_PEMBELI_TIDAK_DITEMUKAN", username }, 404);
      }
      return json({ error: "SETTLE_ERROR: " + msg }, 500);
    }

    return json({
      ok: true,
      already: !!res?.already,
      gems: res?.gems ?? pack.gems,
      balance: res?.balance ?? null,
      transaction_id: transactionId,
      username,
      pack_id: pack.id,
    });
  } catch (err) {
    console.error("trakteer-webhook error", err);
    return json({ error: "SERVER_ERROR: " + (err?.message || String(err)) }, 500);
  }
});
