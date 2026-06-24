// Re-sends the WhatsApp confirmation for an existing order and logs a retry event.
// Public (no JWT) but rate-limited per order_number to avoid abuse.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const orderNumber = Number(body.order_number);
    const reason: string = typeof body.reason === "string" ? body.reason.slice(0, 240) : "";
    const actorId: string | null = typeof body.actor_id === "string" ? body.actor_id : null;
    const actorName: string | null = typeof body.actor_name === "string" ? body.actor_name.slice(0, 120) : null;
    if (!orderNumber || Number.isNaN(orderNumber)) {
      return new Response(JSON.stringify({ error: "order_number required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error: orderErr } = await sb
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, total, subtotal, delivery_price, notes, order_items(quantity, product_name, total_price)")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "order_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit + attempt counter (últimos 10 min).
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count, data: recent } = await sb
      .from("whatsapp_message_events")
      .select("id", { count: "exact" })
      .eq("order_id", order.id)
      .eq("status", "retry_requested")
      .gte("created_at", since);
    const attemptsSoFar = count ?? recent?.length ?? 0;
    if (attemptsSoFar >= 3) {
      return new Response(JSON.stringify({ error: "rate_limited", retry_after_seconds: 600 }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const attempt = attemptsSoFar + 1;
    const retryPayload = {
      source: "pedido_page",
      attempt,
      reason: reason || null,
      actor_id: actorId,
      actor_name: actorName,
      requested_at: new Date().toISOString(),
    };
    await sb.from("whatsapp_message_events").insert({
      order_id: order.id,
      status: "retry_requested",
      payload: retryPayload,
    });

    // Fire YCloud send (service-role bearer).
    const resp = await fetch(`${supabaseUrl}/functions/v1/send-ycloud-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        action: "send_order",
        to: order.customer_phone,
        order_number: String(order.order_number),
        customer_name: order.customer_name,
        items: order.order_items ?? [],
        total: Number(order.total) || 0,
        subtotal: Number(order.subtotal) || 0,
        delivery_price: Number(order.delivery_price) || 0,
        notes: order.notes ?? undefined,
      }),
    });
    const sendData = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      await sb.from("whatsapp_message_events").insert({
        order_id: order.id,
        status: "failed",
        error: sendData?.error || `HTTP ${resp.status}`,
        payload: sendData,
      });
      return new Response(JSON.stringify({ error: "send_failed", detail: sendData }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newRef = sendData?.message_id || sendData?.id || order.id;
    await sb.from("whatsapp_message_events").insert({
      order_id: order.id,
      whatsapp_ref: String(newRef),
      status: "sent",
      payload: { ...sendData, attempt, retry_of: retryPayload },
    });

    return new Response(JSON.stringify({ success: true, whatsapp_ref: newRef }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
