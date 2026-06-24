// whatsapp-status-fixture
// Test-only helper: inserta eventos en whatsapp_message_events simulando el
// webhook de YCloud/Cloud API para validar estados (sent, delivered, read, failed)
// sin depender de datos reales.
//
// Auth: requiere header `x-test-token` igual a env WHATSAPP_TEST_TOKEN.
// Si la env no está seteada, devuelve 403 (cerrado por default en prod).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-test-token",
};

const ALLOWED = new Set(["queued", "sent", "delivered", "read", "failed", "retry_requested"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("WHATSAPP_TEST_TOKEN");
  if (!expected) {
    return new Response(JSON.stringify({ error: "fixture_disabled" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const provided = req.headers.get("x-test-token");
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const orderNumber = Number(body.order_number);
    const events: Array<{ status: string; error?: string; whatsapp_ref?: string; delay_ms?: number }> =
      Array.isArray(body.events) ? body.events : [{ status: body.status, error: body.error, whatsapp_ref: body.whatsapp_ref }];

    if (!orderNumber || Number.isNaN(orderNumber)) {
      return new Response(JSON.stringify({ error: "order_number required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: order } = await sb.from("orders").select("id, whatsapp_ref").eq("order_number", orderNumber).maybeSingle();
    if (!order) {
      return new Response(JSON.stringify({ error: "order_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inserted: unknown[] = [];
    for (const ev of events) {
      if (!ALLOWED.has(ev.status)) continue;
      if (ev.delay_ms) await new Promise((r) => setTimeout(r, Math.min(ev.delay_ms, 3000)));
      const { data, error } = await sb.from("whatsapp_message_events").insert({
        order_id: order.id,
        whatsapp_ref: ev.whatsapp_ref ?? order.whatsapp_ref ?? `test-${crypto.randomUUID()}`,
        status: ev.status,
        error: ev.error ?? null,
        payload: { source: "test_fixture", ...ev },
      }).select().single();
      if (error) throw error;
      inserted.push(data);
    }

    return new Response(JSON.stringify({ ok: true, inserted: inserted.length, events: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
