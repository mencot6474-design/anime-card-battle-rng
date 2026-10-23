/* ===========================================================
 * Edge Function: play-verify
 * POST { username, password_hash, product_id, purchase_token, order_id }
 * -> { ok, already, gems, balance }
 *
 * Verifikasi pembelian ke Google Play Developer API (androidpublisher)
 * memakai service account JWT, lalu settlement idempotent via RPC
 * settle_play_purchase (kunci idempotensi = purchase_token).
 *
 * Env yang dibutuhkan:
 *  - PLAY_PACKAGE_NAME          (com.mencot6474.animecardbattle)
 *  - PLAY_SERVICE_ACCOUNT_JSON  (service account JSON sebagai string)
 * =========================================================== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  json,
  normUser,
  verifyPlayer,
  getPackByProductId,
} from "../_shared/packs.ts";

const PLAY_API = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/* ---------- JWT service account ---------- */
function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlFromString(s: string): string {
  return base64UrlEncode(new TextEncoder().encode(s));
}

async function importPkcs8(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    bin,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

let cachedAccessToken: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.exp > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const raw = Deno.env.get("PLAY_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("PLAY_SERVICE_ACCOUNT_JSON belum di-set");

  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlFromString(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64UrlFromString(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const data = `${header}.${claim}`;
  const key = await importPkcs8(sa.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(data),
  );
  const assertion = `${data}.${base64UrlEncode(new Uint8Array(sig))}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) {
    throw new Error("Gagal dapat access token Play: " + JSON.stringify(j).slice(0, 300));
  }
  cachedAccessToken = { token: j.access_token, exp: now + Number(j.expires_in || 3600) };
  return cachedAccessToken.token;
}


/**
 * Verifikasi purchaseToken lewat Play Developer API.
 * Purchase state: 0 = PURCHASED, 1 = CANCELED, 2 = PENDING.
 */
async function verifyPurchase(
  packageName: string,
  productId: string,
  purchaseToken: string,
): Promise<{ ok: boolean; state: number; orderId: string; purchaseId: string; msg?: string }> {
  const token = await getAccessToken();
  const url = `${PLAY_API}/applications/${encodeURIComponent(packageName)}/purchases/products/` +
    `${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await res.json().catch(() => ({}));

  if (!res.ok) {
    const reason = j?.error?.message || `HTTP ${res.status}`;
    // 404 = token tidak dikenal (pembayaran belum tercatat / sudah refund)
    return { ok: false, state: -1, orderId: "", purchaseId: "", msg: reason };
  }
  return {
    ok: true,
    state: typeof j.purchaseState === "number" ? j.purchaseState : 0,
    orderId: j.orderId || "",
    purchaseId: j.purchaseId || "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const body = await req.json().catch(() => ({}));
    const username = normUser(body.username);
    const passwordHash = String(body.password_hash || "");
    const productId = String(body.product_id || "");
    const purchaseToken = String(body.purchase_token || "");
    const orderId = String(body.order_id || "");

    if (!purchaseToken) return json({ error: "PURCHASE_TOKEN_WAJIB" }, 400);

    /* Harga & gems SELALU dari server (packs.ts), bukan dari client. */
    const pack = getPackByProductId(productId);
    if (!pack) return json({ error: "PRODUCT_ID_TIDAK_DIKETAHUI" }, 400);

    const packageName = Deno.env.get("PLAY_PACKAGE_NAME") || "com.mencot6474.animecardbattle";

    /* 1) Verifikasi ke Google Play. */
    let play;
    try {
      play = await verifyPurchase(packageName, productId, purchaseToken);
    } catch (e) {
      return json({ error: "PLAY_API_ERROR: " + (e?.message || String(e)) }, 502);
    }

    if (!play.ok) {
      return json({ error: "PEMBELIAN_TIDAK_VALID: " + (play.msg || "tidak terverifikasi") }, 400);
    }
    if (play.state === 2) {
      return json({ error: "PEMBELIAN_MASIH_PENDING" }, 409);
    }
    if (play.state === 1) {
      return json({ error: "PEMBELIAN_DIBATALKAN" }, 400);
    }

    /* 2) Authenticate user (username + password hash). */
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const auth = await verifyPlayer(supabase, username, passwordHash);
    if (!auth.ok) return json({ error: auth.msg || "AUTH_GAGAL" }, 401);

    /* 3) Settlement idempotent (kunci = purchase_token). */
    const { data, error } = await supabase.rpc("settle_play_purchase", {
      p_purchase_token: purchaseToken,
      p_purchase_id: play.purchaseId,
      p_order_id: orderId || play.orderId,
      p_username: username,
      p_pack_id: pack.id,
      p_product_id: productId,
      p_gems: pack.gems,
      p_amount_idr: pack.amountIdr,
      p_purchase_state: play.state,
      p_acknowledged: body.acknowledged === true,
    });

    if (error) {
      return json({ error: "SETTLE_ERROR: " + error.message }, 500);
    }

    return json({
      ok: true,
      already: !!data?.already,
      gems: pack.gems,
      balance: data?.balance ?? null,
      order_id: orderId || play.orderId || "",
    });
  } catch (err) {
    console.error("play-verify error", err);
    return json({ error: "SERVER_ERROR: " + (err?.message || String(err)) }, 500);
  }
});
