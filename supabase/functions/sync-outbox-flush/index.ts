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

    if (row.target === "einvoice_emit_retry") {
      const res = await retryEinvoice(p);
      return res;
    }

    return { ok: false, error: `unknown_target: ${row.target}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ===== Innapsis DIAN retry worker (Slice 4) =====
const INNAPSIS_CLIENT_ID = Deno.env.get("INNAPSIS_CLIENT_ID") ?? "b899c906-fe51-4eba-a054-62ca2220452f";
const INNAPSIS_CLIENT_SECRET = Deno.env.get("INNAPSIS_CLIENT_SECRET");
const INNAPSIS_PARTNER_API_KEY = Deno.env.get("INNAPSIS_PARTNER_API_KEY");
const INNAPSIS_TOKEN_URL = "https://facturaeb2c.b2clogin.com/facturaeb2c.onmicrosoft.com/oauth2/v2.0/token";
const INNAPSIS_POLICY = "B2C_1A_FE_CLIENT_CREDENTIALS_V30";
const INNAPSIS_SCOPE = "https://facturaeb2c.onmicrosoft.com/client-api/.default";
const INNAPSIS_BASE_DEV = "https://rt9g83x6z0.execute-api.us-east-1.amazonaws.com";
const INNAPSIS_BASE_PROD = "https://nc8sa9bmte.execute-api.us-east-1.amazonaws.com";

async function getInnapsisToken(nit: string, apiKey: string): Promise<string> {
  if (!INNAPSIS_CLIENT_SECRET) throw new Error("INNAPSIS_CLIENT_SECRET not configured");
  const url = `${INNAPSIS_TOKEN_URL}?p=${INNAPSIS_POLICY}&saasTenantId=${encodeURIComponent(nit)}&apiKey=${encodeURIComponent(apiKey)}`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: INNAPSIS_CLIENT_ID,
    client_secret: INNAPSIS_CLIENT_SECRET,
    scope: INNAPSIS_SCOPE,
  });
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`innapsis auth ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

async function retryEinvoice(payload: any): Promise<{ ok: boolean; error?: string; permanent?: boolean }> {
  const invoiceId: string | undefined = payload?.invoice_id;
  const orgId: string | undefined = payload?.organization_id;
  if (!invoiceId || !orgId) return { ok: false, error: "missing invoice_id/organization_id", permanent: true };

  const { data: inv, error: invErr } = await supabase
    .from("electronic_invoices")
    .select("id, organization_id, status, request_payload, retry_count")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invErr || !inv) return { ok: false, error: invErr?.message ?? "invoice_not_found", permanent: true };
  if (["sent", "accepted"].includes(String(inv.status))) {
    return { ok: true }; // ya quedó OK por otra vía
  }
  if (!inv.request_payload) return { ok: false, error: "missing request_payload", permanent: true };

  const { data: cfg } = await supabase
    .from("einvoice_configs")
    .select("nit, api_key, environment, id, resolution_current")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .maybeSingle();
  if (!cfg) return { ok: false, error: "config_inactive", permanent: true };

  try {
    const token = await getInnapsisToken(cfg.nit as string, (cfg.api_key as string) || INNAPSIS_PARTNER_API_KEY || "");
    const baseUrl = cfg.environment === "prod" ? INNAPSIS_BASE_PROD : INNAPSIS_BASE_DEV;
    const endpoint = `${baseUrl}/api/v1/emision/emision/envieDocumento`;
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(inv.request_payload),
    });
    const j = await r.json().catch(() => ({}));
    const newRetryCount = (inv.retry_count ?? 0) + 1;

    if (r.ok) {
      await supabase.from("electronic_invoices").update({
        status: "sent",
        dian_response: j,
        last_error: null,
        retry_count: newRetryCount,
        next_retry_at: null,
        cufe: j?.cufe ?? j?.Cufe ?? null,
        qr_url: j?.qr_url ?? j?.QrUrl ?? null,
        xml_url: j?.xml_url ?? j?.XmlUrl ?? null,
        pdf_url: j?.pdf_url ?? j?.PdfUrl ?? null,
      }).eq("id", invoiceId);

      await supabase.from("einvoice_events").insert({
        organization_id: orgId,
        invoice_id: invoiceId,
        event_type: "emit_retry_success",
        status: "sent",
        message: `Reintento exitoso (intento ${newRetryCount})`,
        response: j,
      });
      return { ok: true };
    }

    const permanent = r.status >= 400 && r.status < 500;
    await supabase.from("electronic_invoices").update({
      status: permanent ? "error" : "retrying",
      last_error: `HTTP ${r.status}`,
      retry_count: newRetryCount,
      dian_response: j,
    }).eq("id", invoiceId);

    await supabase.from("einvoice_events").insert({
      organization_id: orgId,
      invoice_id: invoiceId,
      event_type: permanent ? "emit_retry_permanent" : "emit_retry_failed",
      status: permanent ? "error" : "retrying",
      message: `Innapsis HTTP ${r.status} (intento ${newRetryCount})`,
      response: j,
    });
    return { ok: false, error: `HTTP ${r.status}: ${JSON.stringify(j).slice(0, 200)}`, permanent };
  } catch (e: any) {
    const newRetryCount = (inv.retry_count ?? 0) + 1;
    await supabase.from("electronic_invoices").update({
      last_error: String(e?.message ?? e),
      retry_count: newRetryCount,
    }).eq("id", invoiceId);
    await supabase.from("einvoice_events").insert({
      organization_id: orgId,
      invoice_id: invoiceId,
      event_type: "emit_retry_failed",
      status: "retrying",
      message: `Error red intento ${newRetryCount}: ${String(e?.message ?? e)}`,
    });
    return { ok: false, error: String(e?.message ?? e) };
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Etapa 30: gate público — exige service_role key o CRON_SECRET para evitar drenajes externos.
  const auth = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const cronSecret = Deno.env.get("CRON_SECRET");
  const ok = (auth && auth === SERVICE_KEY) || (cronSecret && auth === cronSecret);
  if (!ok) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
