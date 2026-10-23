/* ===========================================================
 * Edge Function: xendit-webhook  (callback Xendit Invoice)
 * Verifikasi token -> cek status PAID/SETTLED -> kredit gems 1x
 * Deploy dengan --no-verify-jwt (Xendit tidak kirim JWT).
 * =========================================================== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS, json, normUser } from "../_shared/packs.ts";

const PAID_STATUSES = ["PAID", "SETTLED", "paid", "settled"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const callbackToken = Deno.env.get("XENDIT_CALLBACK_TOKEN");
    const secretKey = Deno.env.get("XENDIT_SECRET_KEY");

    // ---- 1. Verifikasi token callback Xendit ----
    if (callbackToken) {
      const tok = req.headers.get("x-callback-token") || req.headers.get("x-webhook-token");
      if (!tok || tok !== callbackToken) {
        console.warn("webhook: token callback tidak cocok");
        return json({ error: "INVALID_CALLBACK_TOKEN" }, 401);
      }
    } else {
      console.warn("webhook: XENDIT_CALLBACK_TOKEN belum di-set (verifikasi dilewati)");
    }

    const payload = await req.json().catch(() => ({}));
    const externalId = payload.external_id || payload.externalId || "";
    const invoiceId = payload.id || payload.invoice_id || "";
    const status = String(payload.status || "").toUpperCase();

    if (!externalId && !invoiceId) {
      return json({ error: "PAYLOAD_TIDAK_VALID" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ---- 2. Cari order ----
    let q = supabase.from("topup_orders").select("*");
    q = externalId ? q.eq("external_id", externalId) : q.eq("xendit_invoice_id", invoiceId);
    const { data: rows, error: selErr } = await q.limit(1);
    if (selErr) return json({ error: "DB_ERROR: " + selErr.message }, 500);

    const order = rows && rows.length ? rows[0] : null;
    if (!order) {
      console.warn("webhook: order tidak ditemukan", externalId, invoiceId);
      return json({ ok: false, error: "ORDER_NOT_FOUND" }, 404);
    }

    // ---- 3. Status ber-terminasi ----
    if (!PAID_STATUSES.includes(status)) {
      if (status === "EXPIRED" || status === "FAILED" || status === "CANCELLED" || status === "PENDING") {
        if (status !== "PENDING" && order.status !== "paid") {
          await supabase.from("topup_orders")
            .update({ status: status === "EXPIRED" ? "expired" : "failed", updated_at: new Date().toISOString() })
            .eq("order_id", order.order_id)
            .neq("status", "paid");
        }
      }
      return json({ ok: true, handled: false, order_id: order.order_id, status });
    }

    // ---- 4. Settlement idempotent (fungsi DB, row lock) ----
    const { data: settled, error: settleErr } = await supabase.rpc("settle_topup", {
      p_order_id: order.order_id,
    });
    if (settleErr) {
      console.error("settle_topup error", settleErr.message);
      return json({ error: "SETTLE_GAGAL: " + settleErr.message }, 500);
    }

    // ---- 5. Xendit invoice URL (untuk display di client) ----
    let invoiceUrl = order.invoice_url;
    if (!invoiceUrl && secretKey && invoiceId) {
      try {
        const r = await fetch("https://api.xendit.co/v2/invoices/" + encodeURIComponent(invoiceId), {
          headers: { Authorization: "Basic " + btoa(secretKey + ":") },
        });
        const b = await r.json();
        if (b && b.invoice_url) {
          invoiceUrl = b.invoice_url;
          await supabase.from("topup_orders").update({ invoice_url: invoiceUrl }).eq("order_id", order.order_id);
        }
      } catch (_) { /* abaikan */ }
    }

    return json({
      ok: true,
      handled: true,
      already: !!(settled && settled.already),
      order_id: order.order_id,
      username: normUser(order.username),
      gems: order.gems,
      balance: settled && settled.balance,
      invoice_url: invoiceUrl,
    });
  } catch (err) {
    console.error("webhook error", err);
    return json({ error: "SERVER_ERROR: " + (err?.message || String(err)) }, 500);
  }
});
