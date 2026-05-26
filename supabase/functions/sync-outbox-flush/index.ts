// Drains pending entries from public.sync_outbox.
// Dispatch by target:
//   - wp_revalidate: POST to payload.revalidate_url
//   - whatsapp_order_confirmed: invoke send-ycloud-whatsapp with order data
//   - wp_product / wp_order: re-invoke their respective edge functions
// Exponential backoff: 1, 5, 30, 120, 720 min. After max_attempts -> status=dead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BACKOFF_MIN = [1, 5, 30, 120, 720];
const BATCH = 25;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function invoke(fnName: string, body: unknown) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text };
}

async function processOne(row: any): Promise<{ ok: boolean; error?: string }> {
  try {
    const p = row.payload ?? {};
    if (row.target === "wp_revalidate") {
      const r = await fetch(p.revalidate_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Revalidate-Token": p.revalidate_token ?? "",
        },
        body: JSON.stringify({ event: p.event ?? "wp_update", post: p.post ?? null, site_id: p.site_id }),
      });
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}: ${await r.text()}` };
      return { ok: true };
    }

    if (row.target === "whatsapp_order_confirmed") {
      const orderId: string | undefined = p.order_id;
      if (!orderId) return { ok: false, error: "missing order_id" };
      const { data: order, error: oErr } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_phone, total, subtotal, delivery_price, notes, order_items(quantity, product_name, total_price)")
        .eq("id", orderId)
        .maybeSingle();
      if (oErr || !order) return { ok: false, error: oErr?.message || "order_not_found" };
      if (!order.customer_phone) return { ok: false, error: "missing customer_phone" };

      const inv = await invoke("send-ycloud-whatsapp", {
        action: "send_order",
        to: order.customer_phone,
        order_number: order.order_number,
        customer_name: order.customer_name,
        items: order.order_items ?? [],
        subtotal: order.subtotal,
        delivery_price: order.delivery_price,
        total: order.total,
        notes: order.notes,
      });
      if (!inv.ok) return { ok: false, error: `ycloud ${inv.status}: ${inv.text.slice(0, 300)}` };
      return { ok: true };
    }

    if (row.target === "wp_product" || row.target === "wp_order") {
      const fn = row.target === "wp_product" ? "sync-products-to-wp" : "sync-order";
      const inv = await invoke(fn, p);
      if (!inv.ok) return { ok: false, error: `${fn} ${inv.status}: ${inv.text.slice(0, 300)}` };
      return { ok: true };
    }

    return { ok: false, error: `unknown_target: ${row.target}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { data: rows, error } = await supabase
      .from("sync_outbox")
      .select("*")
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .order("next_attempt_at", { ascending: true })
      .limit(BATCH);

    if (error) throw error;

    const results: any[] = [];
    for (const row of rows ?? []) {
      const res = await processOne(row);
      const nextAttempts = (row.attempts ?? 0) + 1;
      if (res.ok) {
        await supabase
          .from("sync_outbox")
          .update({ status: "succeeded", succeeded_at: new Date().toISOString(), attempts: nextAttempts, last_error: null })
          .eq("id", row.id);
      } else if (nextAttempts >= (row.max_attempts ?? 5)) {
        await supabase
          .from("sync_outbox")
          .update({ status: "dead", attempts: nextAttempts, last_error: res.error ?? "unknown" })
          .eq("id", row.id);
      } else {
        const delayMin = BACKOFF_MIN[Math.min(nextAttempts - 1, BACKOFF_MIN.length - 1)];
        // Jitter ±20% para evitar thundering herd en reintentos paralelos.
        const jitter = 1 + (Math.random() * 0.4 - 0.2);
        const next = new Date(Date.now() + delayMin * 60_000 * jitter).toISOString();
        await supabase
          .from("sync_outbox")
          .update({ attempts: nextAttempts, last_error: res.error ?? "unknown", next_attempt_at: next })
          .eq("id", row.id);
      }
      results.push({ id: row.id, target: row.target, ok: res.ok, error: res.error });
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
