// YCloud / WhatsApp Cloud API webhook receiver.
// Maps provider events to internal statuses and inserts into whatsapp_message_events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS_MAP: Record<string, string> = {
  queued: "queued",
  accepted: "queued",
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
  undelivered: "failed",
  error: "failed",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    // Normalize: YCloud uses { type:'whatsapp.message.updated', whatsappMessage:{ id, status, errorCode, errorMessage } }
    // Cloud API uses { entry:[{ changes:[{ value:{ statuses:[{ id, status, errors }] } }] }] }
    const items: Array<{ id?: string; status?: string; error?: string; raw: unknown }> = [];

    if (body?.whatsappMessage) {
      const m = body.whatsappMessage;
      items.push({ id: m.id, status: m.status, error: m.errorMessage || m.errorCode, raw: body });
    }
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        for (const st of change?.value?.statuses ?? []) {
          items.push({ id: st.id, status: st.status, error: st.errors?.[0]?.title, raw: st });
        }
      }
    }

    const inserts = items
      .filter((i) => i.id && i.status)
      .map((i) => ({
        whatsapp_ref: i.id!,
        status: STATUS_MAP[String(i.status).toLowerCase()] ?? "sent",
        error: i.error ?? null,
        payload: i.raw as Record<string, unknown>,
      }));

    if (inserts.length === 0) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Backfill order_id from whatsapp_ref when possible.
    const refs = inserts.map((i) => i.whatsapp_ref);
    const { data: orders } = await sb.from("orders").select("id, whatsapp_ref").in("whatsapp_ref", refs);
    const refToOrder = new Map((orders ?? []).map((o) => [o.whatsapp_ref, o.id]));
    const rows = inserts.map((i) => ({ ...i, order_id: refToOrder.get(i.whatsapp_ref) ?? null }));

    const { error } = await sb.from("whatsapp_message_events").insert(rows);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
