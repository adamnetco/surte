import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Defaults compartidos (Innapsis FacturaE v30). El client_secret SOLO viene
// de secretos — si falta, la función se cae con 500 (sin fallback hardcoded).
const INNAPSIS_CLIENT_ID = Deno.env.get("INNAPSIS_CLIENT_ID") ?? "b899c906-fe51-4eba-a054-62ca2220452f";
const INNAPSIS_CLIENT_SECRET = Deno.env.get("INNAPSIS_CLIENT_SECRET");
// API key global de partner Innapsis (fallback si el tenant no tiene una propia).
const INNAPSIS_PARTNER_API_KEY = Deno.env.get("INNAPSIS_PARTNER_API_KEY");
const INNAPSIS_DEFAULTS = {
  client_id: INNAPSIS_CLIENT_ID,
  policy: "B2C_1A_FE_CLIENT_CREDENTIALS_V30",
  scope: "https://facturaeb2c.onmicrosoft.com/client-api/.default",
  token_url: "https://facturaeb2c.b2clogin.com/facturaeb2c.onmicrosoft.com/oauth2/v2.0/token",
  base_dev: "https://rt9g83x6z0.execute-api.us-east-1.amazonaws.com",
  base_prod: "https://nc8sa9bmte.execute-api.us-east-1.amazonaws.com",
};

// Cache simple de tokens en memoria del worker (vida 50 min)
const tokenCache = new Map<string, { token: string; exp: number }>();

async function getToken(nit: string, apiKey: string): Promise<string> {
  const key = `${nit}:${apiKey}`;
  const cached = tokenCache.get(key);
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;

  const url = `${INNAPSIS_DEFAULTS.token_url}?p=${INNAPSIS_DEFAULTS.policy}&saasTenantId=${encodeURIComponent(nit)}&apiKey=${encodeURIComponent(apiKey)}`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: INNAPSIS_DEFAULTS.client_id,
    client_secret: INNAPSIS_CLIENT_SECRET!,
    scope: INNAPSIS_DEFAULTS.scope,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Innapsis auth failed [${res.status}]: ${JSON.stringify(json)}`);
  }
  tokenCache.set(key, { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 });
  return json.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!INNAPSIS_CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "INNAPSIS_CLIENT_SECRET not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: authErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub;

    const { organization_id, pos_order_id, order_id, document_type = "invoice" } = await req.json();
    if (!organization_id || (!pos_order_id && !order_id)) {
      return new Response(JSON.stringify({ error: "organization_id y pos_order_id u order_id requeridos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Service client para acceso garantizado a config + orden
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 0) Verifica que el usuario sea miembro activo de la organización solicitada.
    const { data: membership } = await admin
      .from("organization_members")
      .select("id, role")
      .eq("organization_id", organization_id)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1) Verifica config activa
    const { data: cfg } = await admin
      .from("einvoice_configs")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!cfg) {
      return new Response(JSON.stringify({ error: "No hay configuración Innapsis activa para esta organización" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Carga la orden
    let order: any = null;
    let items: any[] = [];
    if (pos_order_id) {
      const { data: o } = await admin.from("pos_orders").select("*").eq("id", pos_order_id).single();
      const { data: it } = await admin.from("pos_order_items").select("*").eq("pos_order_id", pos_order_id);
      order = o; items = it ?? [];
    } else {
      const { data: o } = await admin.from("orders").select("*").eq("id", order_id).single();
      const { data: it } = await admin.from("order_items").select("*").eq("order_id", order_id);
      order = o; items = it ?? [];
    }
    if (!order) {
      return new Response(JSON.stringify({ error: "Orden no encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3) Asigna número
    const nextNumber = (cfg.resolution_current ?? cfg.resolution_from ?? 1) as number;
    const fullNumber = `${cfg.resolution_prefix ?? ""}${nextNumber}`;
    const trackId = crypto.randomUUID();

    const payload = {
      trackId,
      tipoDocumento: document_type === "credit_note" ? "91" : document_type === "debit_note" ? "92" : "01",
      prefijo: cfg.resolution_prefix,
      numero: nextNumber,
      adquiriente: {
        tipoIdentificacion: "13",
        identificacion: order.customer_document ?? "222222222222",
        razonSocial: order.customer_name ?? "Consumidor Final",
        email: order.customer_email ?? null,
      },
      totales: {
        subtotal: Number(order.subtotal ?? 0),
        impuestos: Number(order.tax ?? order.tax_total ?? 0),
        total: Number(order.total ?? 0),
      },
      items: items.map((it: any, idx: number) => ({
        linea: idx + 1,
        descripcion: it.product_name ?? it.name ?? "Item",
        cantidad: Number(it.quantity ?? 1),
        precioUnitario: Number(it.unit_price ?? 0),
        total: Number(it.total ?? it.total_price ?? it.line_total ?? 0),
      })),
    };

    // 4) Crea registro pending
    const { data: inv, error: invErr } = await admin.from("electronic_invoices").insert({
      organization_id,
      location_id: order.location_id ?? null,
      document_type,
      pos_order_id: pos_order_id ?? null,
      order_id: order_id ?? null,
      prefix: cfg.resolution_prefix,
      number: nextNumber,
      full_number: fullNumber,
      customer_identification: payload.adquiriente.identificacion,
      customer_name: payload.adquiriente.razonSocial,
      customer_email: payload.adquiriente.email,
      subtotal: payload.totales.subtotal,
      tax_total: payload.totales.impuestos,
      total: payload.totales.total,
      track_id: trackId,
      status: "sending",
      request_payload: payload,
      environment: cfg.environment,
      created_by: userId,
    }).select().single();

    if (invErr) throw invErr;

    // 5) Llama Innapsis
    try {
      const token = await getToken(cfg.nit, cfg.api_key);
      const baseUrl = cfg.environment === "prod" ? INNAPSIS_DEFAULTS.base_prod : INNAPSIS_DEFAULTS.base_dev;
      const endpoint = `${baseUrl}/api/v1/emision/emision/envieDocumento`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const responseJson = await res.json().catch(() => ({}));

      const status = res.ok ? "sent" : "error";
      await admin.from("electronic_invoices").update({
        status,
        dian_response: responseJson,
        last_error: res.ok ? null : `HTTP ${res.status}`,
      }).eq("id", inv.id);

      // Avanza contador si fue ok
      if (res.ok) {
        await admin.from("einvoice_configs").update({
          resolution_current: nextNumber + 1,
        }).eq("id", cfg.id);
      }

      await admin.from("einvoice_events").insert({
        organization_id,
        invoice_id: inv.id,
        event_type: "emit",
        status,
        message: res.ok ? "Documento enviado a Innapsis" : `Error HTTP ${res.status}`,
        payload,
        response: responseJson,
        performed_by: userId,
      });

      return new Response(JSON.stringify({ success: res.ok, invoice_id: inv.id, track_id: trackId, response: responseJson }), {
        status: res.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      await admin.from("electronic_invoices").update({
        status: "error",
        last_error: e.message,
      }).eq("id", inv.id);
      await admin.from("einvoice_events").insert({
        organization_id,
        invoice_id: inv.id,
        event_type: "emit",
        status: "error",
        message: e.message,
        payload,
        performed_by: userId,
      });
      throw e;
    }
  } catch (err: any) {
    console.error("innapsis-emit error", err);
    return new Response(JSON.stringify({ error: err.message ?? "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
