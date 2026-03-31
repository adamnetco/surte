import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const YCLOUD_API = "https://api.ycloud.com/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get YCloud credentials from app_settings
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["ycloud_api_key", "ycloud_from_number"]);

    const settings: Record<string, string> = {};
    settingsRows?.forEach((r: any) => { settings[r.key] = r.value; });

    const apiKey = settings.ycloud_api_key;
    const fromNumber = settings.ycloud_from_number;

    if (!apiKey || !fromNumber) {
      return new Response(
        JSON.stringify({ error: "YCloud no configurado. Agrega API Key y número en Configuración." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
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
        .map((i: any) => `• ${i.quantity}x ${i.product_name} — $${Number(i.total_price).toLocaleString("es-CO")}`)
        .join("\n");

      const message = [
        `🧾 *SURTÉ YA — Pedido #${order_number}*`,
        ``,
        `Hola ${customer_name || "Cliente"} 👋`,
        `Tu pedido ha sido recibido:`,
        ``,
        itemLines,
        ``,
        `Subtotal: $${Number(subtotal || 0).toLocaleString("es-CO")}`,
        `Envío: $${Number(delivery_price || 0).toLocaleString("es-CO")}`,
        `*Total: $${Number(total).toLocaleString("es-CO")}*`,
        notes ? `\n📝 Notas: ${notes}` : "",
        ``,
        `Gracias por tu compra 🛒`,
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
