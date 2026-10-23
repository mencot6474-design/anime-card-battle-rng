/* ===========================================================
 * Edge Function: create-invoice
 * POST { username, password_hash, pack_id }
 * -> { order_id, invoice_url, amount_idr, gems }
 * =========================================================== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS, TOPUP_PACKS, getPack, json, normUser, verifyPlayer, cloudGems,
} from "../_shared/packs.ts";

const XENDIT_API = "https://api.xendit.co";

function newOrderId(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return "aab_" + ts + "_" + rnd;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const secretKey = Deno.env.get("XENDIT_SECRET_KEY");
    if (!secretKey) {
      return json({ error: "XENDIT_SECRET_KEY belum di-set di Edge Function secrets" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const username = normUser(body.username);
    const passwordHash = String(body.password_hash || "");
    const packId = String(body.pack_id || "");

    const pack = getPack(packId);
    if (!pack) return json({ error: "PAKET_TIDAK_VALID" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const auth = await verifyPlayer(supabase, username, passwordHash);
    if (!auth.ok) return json({ error: auth.msg || "AUTH_GAGAL" }, 401);

    const orderId = newOrderId();
    const externalId = "aab-" + orderId;

    const { error: insErr } = await supabase.from("topup_orders").insert({
      order_id: orderId,
      external_id: externalId,
      username,
      pack_id: pack.id,
      gems: pack.gems,
      amount_idr: pack.amountIdr,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (insErr) return json({ error: "GAGAL_SIMPAN_ORDER: " + insErr.message }, 500);

    // ---- Create invoice di Xendit ----
    const xenditRes = await fetch(XENDIT_API + "/v2/invoices", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(secretKey + ":"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_id: externalId,
        amount: pack.amountIdr,
        currency: "IDR",
        description: "Top-Up Gems - " + pack.gems + " Gems",
        invoice_duration: 3600,
        customer: body.customer_email ? { email: String(body.customer_email) } : undefined,
        success_redirect_url: Deno.env.get("TOPUP_REDIRECT_URL") || undefined,
        failure_redirect_url: Deno.env.get("TOPUP_REDIRECT_URL") || undefined,
        customer_notification_preference: { invoice_created: [], invoice_reminder: [], invoice_paid: [], invoice_expired: [] },
      }),
    });

    const xenditBody = await xenditRes.json().catch(() => ({}));
    if (!xenditRes.ok) {
      await supabase.from("topup_orders")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("order_id", orderId);
      return json({
        error: "XENDIT_GAGAL: " + (xenditBody.message || xenditRes.status),
        detail: xenditBody,
      }, 502);
    }

    const invoiceId = xenditBody.id;
    const invoiceUrl = xenditBody.invoice_url;

    await supabase.from("topup_orders").update({
      xendit_invoice_id: invoiceId,
      invoice_url: invoiceUrl,
      updated_at: new Date().toISOString(),
    }).eq("order_id", orderId);

    return json({
      ok: true,
      order_id: orderId,
      invoice_id: invoiceId,
      invoice_url: invoiceUrl,
      amount_idr: pack.amountIdr,
      gems: pack.gems,
      balance: cloudGems(auth.row),
      packs: TOPUP_PACKS,
    });
  } catch (err) {
    console.error("create-invoice error", err);
    return json({ error: "SERVER_ERROR: " + (err?.message || String(err)) }, 500);
  }
});
