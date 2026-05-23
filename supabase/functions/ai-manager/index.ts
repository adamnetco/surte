// Gerente IA: analiza ventas, márgenes y stock; genera insights vía Lovable AI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { organization_id } = await req.json();
    if (!organization_id) return json({ error: "organization_id requerido" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Datos contextuales: top productos por margen débil + bajo stock
    const { data: products } = await supabase
      .from("products")
      .select("id,name,price,cost_price,price_wholesale,brand,category_id")
      .eq("is_active", true)
      .limit(80);

    const { data: stock } = await supabase
      .from("product_stock")
      .select("product_id,quantity,avg_cost")
      .limit(200);

    // Snapshot ventas últimos 30 días
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_id,quantity,unit_price,created_at")
      .gte("created_at", since)
      .limit(500);

    const ctx = {
      products: (products ?? []).slice(0, 60),
      stock: stock ?? [],
      recent_sales: orderItems ?? [],
      generated_at: new Date().toISOString(),
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Eres el Gerente IA de SISTECPOS, un minimarket en Colombia (COP). Analiza los datos y produce de 3 a 8 recomendaciones concretas y accionables sobre: precios, márgenes, stock bajo, productos sin rotación y oportunidades de upsell. Sé directo y específico (menciona nombres y cifras)." },
          { role: "user", content: "DATA:\n" + JSON.stringify(ctx).slice(0, 60000) },
        ],
        tools: [{
          type: "function",
          function: {
            name: "emit_insights",
            description: "Emite recomendaciones del gerente",
            parameters: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string", enum: ["pricing","stock","margin","demand","supplier","general"] },
                      severity: { type: "string", enum: ["info","warn","critical"] },
                      title: { type: "string" },
                      message: { type: "string" },
                      product_id: { type: "string", nullable: true },
                      payload: { type: "object", additionalProperties: true },
                    },
                    required: ["category","severity","title","message"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["insights"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_insights" } },
      }),
    });

    if (aiRes.status === 429) return json({ error: "Rate limit. Intenta en 1 minuto." }, 429);
    if (aiRes.status === 402) return json({ error: "Sin créditos de IA. Agrega fondos en Workspace > Usage." }, 402);
    if (!aiRes.ok) return json({ error: "AI gateway error", details: await aiRes.text() }, 500);

    const data = await aiRes.json();
    const args = JSON.parse(data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}");
    const insights = args.insights ?? [];

    // Guardar
    const rows = insights.map((i: any) => ({
      organization_id,
      category: i.category,
      severity: i.severity,
      title: i.title,
      message: i.message,
      product_id: i.product_id || null,
      payload: i.payload ?? {},
    }));
    if (rows.length) await supabase.from("ai_insights").insert(rows);

    return json({ ok: true, count: rows.length, insights });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
