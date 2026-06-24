import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INNAPSIS_CLIENT_ID = Deno.env.get("INNAPSIS_CLIENT_ID") ?? "b899c906-fe51-4eba-a054-62ca2220452f";
const INNAPSIS_CLIENT_SECRET = Deno.env.get("INNAPSIS_CLIENT_SECRET");
const INNAPSIS_PARTNER_API_KEY = Deno.env.get("INNAPSIS_PARTNER_API_KEY");
const INNAPSIS = {
  client_id: INNAPSIS_CLIENT_ID,
  policy: "B2C_1A_FE_CLIENT_CREDENTIALS_V30",
  scope: "https://facturaeb2c.onmicrosoft.com/client-api/.default",
  token_url: "https://facturaeb2c.b2clogin.com/facturaeb2c.onmicrosoft.com/oauth2/v2.0/token",
  base_dev: "https://rt9g83x6z0.execute-api.us-east-1.amazonaws.com",
  base_prod: "https://nc8sa9bmte.execute-api.us-east-1.amazonaws.com",
};

async function getToken(nit: string, apiKey: string) {
  const url = `${INNAPSIS.token_url}?p=${INNAPSIS.policy}&saasTenantId=${encodeURIComponent(nit)}&apiKey=${encodeURIComponent(apiKey)}`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: INNAPSIS.client_id,
    client_secret: INNAPSIS_CLIENT_SECRET!,
    scope: INNAPSIS.scope,
  });
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const json = await res.json();
  if (!res.ok) throw new Error(`Auth failed: ${JSON.stringify(json)}`);
  return json.access_token as string;
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

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u, error: ae } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (ae || !u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const { invoice_id, tipo_archivo = "pdf", ping, environment } = body as {
      invoice_id?: string; tipo_archivo?: string; ping?: boolean; environment?: "dev" | "prod";
    };

    // Modo PING: prueba autenticación contra Innapsis usando la config activa del usuario.
    if (ping) {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: memberships } = await admin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .eq("is_active", true);
      const orgIds = (memberships ?? []).map((m: any) => m.organization_id);
      if (orgIds.length === 0) {
        return new Response(JSON.stringify({ error: "Sin organización" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let query = admin.from("einvoice_configs").select("*").in("organization_id", orgIds);
      if (environment) query = query.eq("environment", environment);
      const { data: cfgs } = await query.limit(1);
      const cfg = cfgs?.[0];
      if (!cfg) return new Response(JSON.stringify({ error: "Sin configuración Innapsis" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      try {
        const token = await getToken(cfg.nit, cfg.api_key || INNAPSIS_PARTNER_API_KEY || "");
        // Hop 2: validar autorización en API gateway via consulteManuales (best-effort).
        const baseUrl = cfg.environment === "prod" ? INNAPSIS.base_prod : INNAPSIS.base_dev;
        let gatewayOk = false;
        let gatewayStatus: number | null = null;
        let gatewayDetail: unknown = null;
        try {
          const gwRes = await fetch(`${baseUrl}/api/v1/configuraciones/manuales/consulteManuales`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ nit: cfg.nit }),
          });
          gatewayStatus = gwRes.status;
          gatewayOk = gwRes.ok;
          gatewayDetail = await gwRes.json().catch(() => null);
        } catch (gwErr: any) {
          gatewayDetail = { error: gwErr?.message ?? String(gwErr) };
        }
        return new Response(JSON.stringify({
          success: true,
          message: `Token OK (${cfg.environment.toUpperCase()})${gatewayOk ? " · gateway OK" : gatewayStatus ? ` · gateway HTTP ${gatewayStatus}` : ""}`,
          token_preview: token.slice(0, 12) + "…",
          gateway: { ok: gatewayOk, status: gatewayStatus, detail: gatewayDetail },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!invoice_id) return new Response(JSON.stringify({ error: "invoice_id requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: inv } = await admin.from("electronic_invoices").select("*").eq("id", invoice_id).single();
    if (!inv) return new Response(JSON.stringify({ error: "Factura no encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Membership check sobre la organización dueña de la factura.
    const { data: membership } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", inv.organization_id)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: cfg } = await admin.from("einvoice_configs").select("*").eq("organization_id", inv.organization_id).eq("is_active", true).maybeSingle();
    if (!cfg) return new Response(JSON.stringify({ error: "Config inactiva" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const token = await getToken(cfg.nit, cfg.api_key || INNAPSIS_PARTNER_API_KEY || "");
    const baseUrl = cfg.environment === "prod" ? INNAPSIS.base_prod : INNAPSIS.base_dev;
    const endpoint = `${baseUrl}/api/v1/emision/emision/consulteArchivo`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: inv.track_id, tipoArchivo: tipo_archivo }),
    });
    const json = await res.json().catch(() => ({}));

    await admin.from("einvoice_events").insert({
      organization_id: inv.organization_id,
      invoice_id: inv.id,
      event_type: "status_check",
      status: res.ok ? "ok" : "error",
      response: json,
    });

    return new Response(JSON.stringify({ success: res.ok, response: json }), {
      status: res.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("innapsis-status error", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
