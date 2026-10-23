/* ===========================================================
 * WHITELIST PAKET TOP-UP (server-side, sumber kebenaran)
 * Harga (IDR) & jumlah gems TIDAK boleh datang dari client.
 * =========================================================== */

export interface TopupPack {
  id: string;
  gems: number;
  amountIdr: number;
  label: string | null;
  bonus: string | null;
  /** Product ID Google Play (billing). Hanya dipakai di build Android. */
  productId: string;
}

/* Harga dasar: 100 Gems = Rp10.000 (tanpa bonus). */
export const TOPUP_PACKS: Record<string, TopupPack> = {
  p100:  { id: "p100",  gems: 100,  amountIdr: 10000,  label: null,         bonus: null, productId: "gems_100" },
  p500:  { id: "p500",  gems: 500,  amountIdr: 50000,  label: null,         bonus: null, productId: "gems_500" },
  p1000: { id: "p1000", gems: 1000, amountIdr: 100000, label: "POPULAR",    bonus: null, productId: "gems_1000" },
  p2500: { id: "p2500", gems: 2500, amountIdr: 250000, label: null,         bonus: null, productId: "gems_2500" },
  p5000: { id: "p5000", gems: 5000, amountIdr: 500000, label: "BEST VALUE", bonus: null, productId: "gems_5000" },
};

/** Semua product ID Play yang valid (untuk query katalog). */
export const PLAY_PRODUCT_IDS: string[] = Object.values(TOPUP_PACKS).map((p) => p.productId);

export function getPack(packId: string): TopupPack | null {
  return Object.prototype.hasOwnProperty.call(TOPUP_PACKS, packId) ? TOPUP_PACKS[packId] : null;
}

/** Cari paket berdasarkan product ID Play. */
export function getPackByProductId(productId: string): TopupPack | null {
  return Object.values(TOPUP_PACKS).find((p) => p.productId === productId) || null;
}

/**
 * Cari paket berdasarkan nominal pembayaran (IDR) — dipakai webhook Trakteer
 * karena Trakteer mengirim nominal (amount), bukan product ID internal kita.
 * Cocokkan persis (toleransi 0) supaya nominal tidak bisa dimanipulasi.
 */
export function getPackByAmountIdr(amountIdr: number): TopupPack | null {
  const n = Number(amountIdr);
  if (!Number.isFinite(n)) return null;
  return Object.values(TOPUP_PACKS).find((p) => p.amountIdr === n) || null;
}

/** Semua nominal IDR yang valid (untuk pesan error webhook). */
export const VALID_AMOUNTS_IDR: number[] = Object.values(TOPUP_PACKS).map((p) => p.amountIdr);

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Normalisasi username (selalu lowercase, sama seperti CloudDB). */
export function normUser(u: string): string {
  return (u || "").trim().toLowerCase();
}

/**
 * Verifikasi user lewat password hash yang disimpan di player_saves.
 * Client game tidak punya Supabase Auth session, jadi ini pengganti JWT.
 */
export async function verifyPlayer(
  supabase: any,
  username: string,
  passwordHash: string,
): Promise<{ ok: boolean; row?: any; msg?: string }> {
  const u = normUser(username);
  if (!u || !passwordHash) return { ok: false, msg: "KREDENSIAL KOSONG" };
  const { data, error } = await supabase
    .from("player_saves")
    .select("username, password, save_data")
    .eq("username", u)
    .limit(1);
  if (error) return { ok: false, msg: "DB ERROR: " + error.message };
  if (!data || data.length === 0) return { ok: false, msg: "AKUN TIDAK DITEMUKAN" };
  const row = data[0];
  if (String(row.password || "") !== String(passwordHash)) {
    return { ok: false, msg: "PASSWORD SALAH" };
  }
  return { ok: true, row };
}

/** Saldo gems tersimpan di cloud. */
export function cloudGems(row: any): number {
  const g = row?.save_data?.premiumGems;
  return typeof g === "number" ? g : 0;
}
