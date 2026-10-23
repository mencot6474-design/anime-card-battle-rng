/* ===========================================================
 * Edge Function: order-status
 * POST { username, password_hash, order_id }
 * -> { status, gems, balance, invoice_url }
 * Fallback: kalau order masih pending, tanya langsung ke Xendit API
 * lalu selesaikan kalau ternyata sudah dibayar (webhook Might miss).
 * =========================================================== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CORS_HEADERS, json, normUser, verifyPlayer, cloudGems } from "../_shared/packs.ts";

const PAID_STATUSES = ["PAID", "SETTLED"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const body = await req.json().catch(() => ({}));
    const username = normUser(body.username);
    const passwordHash = String(body.password_hash || "");
    const orderId = String(body.order_id || "");

    if (!orderId) return json({ error: "ORDER_ID_Wajib" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const auth = await verifyPlayer(supabase, username, passwordHash);
    if (!auth.ok) return json({ error: auth.msg || "AUTH_GAGAL" }, 401);

    const { data: rows, error } = await supabase
      .from("topup_orders")
      .select("*")
      .eq("order_id", orderId)
      .limit(1);
    if (error) return json({ error: "DB_ERROR: " + error.message }, 500);

    const order = rows && rows.length ? rows[0] : null;
    if (!order) return json({ error: "ORDER_NOT_FOUND" }, 404);
    if (order.username !== username) return json({ error: "ORDER_BUKAN_MILIKMU" }, 403);

    // ---- Fallback sync ke Xendit kalau masih pending ----
    if (order.status !== "paid") {
      const secretKey = Deno.env.get("XENDIT_SECRET_KEY");
      if (secretKey && order.xendit_invoice_id) {
        try {
          const r = await fetch("https://api.xendit.co/v2/invoices/" + encodeURIComponent(order.xendit_invoice_id), {
            headers: { Authorization: "Basic " + btoa(secretKey + ":") },
          });
          const inv = await r.json();
          if (inv && inv.status && PAID_STATUSES.includes(String(inv.status).toUpperCase())) {
            await supabase.rpc("settle_topup", { p_order_id: orderId });
          } else if (inv && inv.status && ["EXPIRED", "FAILED", "CANCELLED"].includes(String(inv.status).toUpperCase())) {
            await supabase.from("topup_orders")
              .update({ status: String(inv.status).toUpperCase() === "EXPIRED" ? "expired" : "failed", updated_at: new Date().toISOString() })
              .eq("order_id", orderId).neq("status", "paid");
          }
        } catch (e) {
          console.warn("fallback xendit gagal:", e?.message);
        }
      }
    }

    const { data: fresh } = await supabase
      .from("topup_orders").select("*").eq("order_id", orderId).limit(1);
    const o = (fresh && fresh.length ? fresh[0] : order);

    return json({
      ok: true,
      order_id: o.order_id,
      status: o.status,
      gems: o.gems,
      amount_idr: o.amount_idr,
      invoice_url: o.invoice_url,
      paid_at: o.paid_at,
      balance: cloudGems(auth.row),
    });
  } catch (err) {
    console.error("order-status error", err);
    return json({ error: "SERVER_ERROR: " + (err?.message || String(err)) }, 500);
  }
});
