import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const YCLOUD_API = "https://api.ycloud.com/v2";

// Etapa 27: schemas estrictos por acción.
const Phone = z.string().min(7).max(20).regex(/^[\d+\-\s()]+$/);
const SendOrderSchema = z.object({
  action: z.literal("send_order"),
  to: Phone,
  order_number: z.string().min(1).max(60),
  customer_name: z.string().max(200).optional(),
  items: z.array(z.object({
    quantity: z.number().int().min(1).max(9999),
    product_name: z.string().max(200),
    total_price: z.number().min(0).max(1e10),
  }).passthrough()).max(500).optional(),
  total: z.number().min(0).max(1e10),
  delivery_price: z.number().min(0).max(1e10).optional(),
  subtotal: z.number().min(0).max(1e10).optional(),
  notes: z.string().max(2000).optional(),
  organization_id: z.string().uuid().optional(),
});
const SendTemplateSchema = z.object({
  action: z.literal("send_template"),
  to: Phone,
  template_name: z.string().min(1).max(120),
  language: z.string().max(10).optional(),
  components: z.array(z.any()).max(50).optional(),
  organization_id: z.string().uuid().optional(),
});
const SendTextSchema = z.object({
  action: z.literal("send_text"),
  to: Phone,
  message: z.string().min(1).max(4000),
  organization_id: z.string().uuid().optional(),
});
const CheckBalanceSchema = z.object({
  action: z.literal("check_balance"),
  organization_id: z.string().uuid().optional(),
});
const BodySchema = z.discriminatedUnion("action", [
  SendOrderSchema, SendTemplateSchema, SendTextSchema, CheckBalanceSchema,
]);


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // verify_jwt=true en config.toml; aquí además exigimos rol mínimo o
    // que la llamada venga de otra edge function con service role key.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const isServiceCall = token === serviceKey;
    let callerUserId = "service";
    if (!isServiceCall) {
      const sb = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await sb.auth.getClaims(token);
      const userId = claims?.claims?.sub;
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerUserId = userId;
      const { data: allowed } = await supabase.rpc("has_any_role", {
        _user_id: userId,
        _roles: ["admin", "superadmin", "agente"],
      });
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Etapa 24: scope app_settings por organización (fallback global).
    const { getOrgScopedSettings, resolveCallerOrgId } = await import("../_shared/tenant-guard.ts");
    const bodyPeek = await req.clone().json().catch(() => ({} as any));
    const orgId = await resolveCallerOrgId(supabase, callerUserId, isServiceCall, bodyPeek?.organization_id ?? null);

    const settings = await getOrgScopedSettings(supabase, orgId, ["ycloud_api_key", "ycloud_from_number"]);
    const apiKey = settings.ycloud_api_key;
    const fromNumber = settings.ycloud_from_number;

    if (!apiKey || !fromNumber) {
      return new Response(
        JSON.stringify({ error: "YCloud no configurado para esta organización." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }



    const rawBody = await req.json();
    const parsedBody = BodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return new Response(
        JSON.stringify({ error: "invalid_payload", details: parsedBody.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const body = parsedBody.data;
    const { action } = body;

    // ACTION: send_order — send order confirmation via WhatsApp
    if (action === "send_order") {
      const { to, order_number, customer_name, items, total, delivery_price, subtotal, notes } = body;

      if (!to || !order_number) {
        return new Response(
          JSON.stringify({ error: "Faltan campos: to, order_number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build message
      const itemLines = (items || [])
        .map((i: any) => `- ${i.quantity}x ${i.product_name} $${Number(i.total_price).toLocaleString("es-CO")}`)
        .join("\n");

      const message = [
        `*SURTE YA - Pedido #${order_number}*`,
        ``,
        `Hola ${customer_name || "Cliente"}`,
        `Tu pedido ha sido recibido:`,
        ``,
        itemLines,
        ``,
        `Subtotal: $${Number(subtotal || 0).toLocaleString("es-CO")}`,
        `Envio: $${Number(delivery_price || 0).toLocaleString("es-CO")}`,
        `*Total: $${Number(total).toLocaleString("es-CO")}*`,
        notes ? `\nNotas: ${notes}` : "",
        ``,
        `Gracias por tu compra`,
      ].filter(Boolean).join("\n");

      const yRes = await fetch(`${YCLOUD_API}/whatsapp/messages`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromNumber,
          to: to.replace(/\D/g, ""),
          type: "text",
          text: { body: message },
        }),
      });

      const yData = await yRes.json();

      if (!yRes.ok) {
        console.error("YCloud error:", yData);
        return new Response(
          JSON.stringify({ error: "Error enviando WhatsApp", details: yData }),
          { status: yRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message_id: yData.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: send_template — send a template message
    if (action === "send_template") {
      const { to, template_name, language, components } = body;

      if (!to || !template_name) {
        return new Response(
          JSON.stringify({ error: "Faltan campos: to, template_name" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const yRes = await fetch(`${YCLOUD_API}/whatsapp/messages`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromNumber,
          to: to.replace(/\D/g, ""),
          type: "template",
          template: {
            name: template_name,
            language: { code: language || "es" },
            components: components || [],
          },
        }),
      });

      const yData = await yRes.json();

      if (!yRes.ok) {
        return new Response(
          JSON.stringify({ error: "Error enviando template", details: yData }),
          { status: yRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message_id: yData.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: send_text — send a free-form text message
    if (action === "send_text") {
      const { to, message } = body;

      if (!to || !message) {
        return new Response(
          JSON.stringify({ error: "Faltan campos: to, message" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const yRes = await fetch(`${YCLOUD_API}/whatsapp/messages`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromNumber,
          to: to.replace(/\D/g, ""),
          type: "text",
          text: { body: message },
        }),
      });

      const yData = await yRes.json();

      if (!yRes.ok) {
        return new Response(
          JSON.stringify({ error: "Error enviando mensaje", details: yData }),
          { status: yRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message_id: yData.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: check_balance — check YCloud account balance
    if (action === "check_balance") {
      const yRes = await fetch(`${YCLOUD_API}/balance`, {
        headers: { "X-API-Key": apiKey },
      });
      const yData = await yRes.json();
      return new Response(
        JSON.stringify(yData),
        { status: yRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Acción no reconocida: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
