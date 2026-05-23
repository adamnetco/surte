// OCR de facturas con vinculación a proveedor y SKU del proveedor.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { organization_id, supplier_id, image_base64, image_url, mime_type = "image/jpeg" } = await req.json();
    if (!organization_id) return json({ error: "organization_id requerido" }, 400);
    if (!image_base64 && !image_url) return json({ error: "imagen requerida" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const imageContent = image_base64
      ? { type: "image_url", image_url: { url: `data:${mime_type};base64,${image_base64}` } }
      : { type: "image_url", image_url: { url: image_url } };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un experto en OCR de facturas colombianas. Extrae proveedor, NIT, número de factura, fecha (YYYY-MM-DD), subtotal, IVA, total y todos los renglones. Por cada renglón captura: código/referencia del proveedor (supplier_sku), GTIN/EAN si aparece, descripción, cantidad, unidad, costo unitario y total. Moneda COP. Si un campo no es legible, devuélvelo null." },
          { role: "user", content: [
            { type: "text", text: "Extrae la información estructurada de esta factura de compra." },
            imageContent,
          ] },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_invoice",
            description: "Estructura de factura colombiana",
            parameters: {
              type: "object",
              properties: {
                supplier_name: { type: "string", nullable: true },
                supplier_nit: { type: "string", nullable: true },
                invoice_number: { type: "string", nullable: true },
                invoice_date: { type: "string", nullable: true },
                subtotal: { type: "number", nullable: true },
                tax: { type: "number", nullable: true },
                total: { type: "number", nullable: true },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      supplier_sku: { type: "string", nullable: true },
                      description: { type: "string" },
                      gtin: { type: "string", nullable: true },
                      quantity: { type: "number" },
                      unit: { type: "string", nullable: true },
                      unit_cost: { type: "number" },
                      total: { type: "number", nullable: true },
                    },
                    required: ["description","quantity","unit_cost"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_invoice" } },
      }),
    });

    if (aiRes.status === 429) return json({ error: "Rate limit. Reintenta en 1 minuto." }, 429);
    if (aiRes.status === 402) return json({ error: "Sin créditos de IA." }, 402);
    if (!aiRes.ok) return json({ error: "OCR error", details: await aiRes.text() }, 500);

    const data = await aiRes.json();
    const args = JSON.parse(data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolver supplier_id por NIT si no se mandó
    let resolvedSupplierId: string | null = supplier_id ?? null;
    if (!resolvedSupplierId && args.supplier_nit) {
      const { data: sup } = await supabase.from("suppliers").select("id")
        .eq("organization_id", organization_id).eq("tax_id", args.supplier_nit).maybeSingle();
      resolvedSupplierId = sup?.id ?? null;
    }

    const { data: scan, error } = await supabase.from("invoice_scans").insert({
      organization_id,
      supplier_id: resolvedSupplierId,
      supplier_name: args.supplier_name,
      supplier_nit: args.supplier_nit,
      invoice_number: args.invoice_number,
      invoice_date: args.invoice_date,
      subtotal: args.subtotal,
      tax: args.tax,
      total: args.total,
      image_url: image_url ?? null,
      raw_ocr: args,
      status: "pending",
    }).select().single();
    if (error) return json({ error: error.message }, 500);

    const items = (args.items ?? []).map((it: any, i: number) => ({
      scan_id: scan.id,
      line_no: i + 1,
      supplier_sku: it.supplier_sku ?? null,
      description: it.description,
      gtin: it.gtin ?? null,
      quantity: it.quantity ?? 1,
      unit: it.unit ?? null,
      unit_cost: it.unit_cost ?? 0,
      total: it.total ?? (it.unit_cost * it.quantity),
    }));

    // Auto-match: 1) supplier_sku via supplier_products, 2) GTIN, 3) nombre
    for (const it of items) {
      let matched: string | null = null;
      if (resolvedSupplierId && it.supplier_sku) {
        const { data: sp } = await supabase.from("supplier_products").select("product_id")
          .eq("supplier_id", resolvedSupplierId).eq("supplier_sku", it.supplier_sku).maybeSingle();
        matched = sp?.product_id ?? null;
      }
      if (!matched && it.gtin) {
        const { data: p } = await supabase.from("products").select("id").eq("gtin", it.gtin).maybeSingle();
        matched = p?.id ?? null;
      }
      if (!matched) {
        const { data: p } = await supabase.from("products").select("id")
          .ilike("name", `%${it.description.slice(0, 24)}%`).limit(1).maybeSingle();
        matched = p?.id ?? null;
      }
      (it as any).matched_product_id = matched;
    }

    if (items.length) await supabase.from("invoice_scan_items").insert(items);

    return json({ ok: true, scan_id: scan.id, supplier_id: resolvedSupplierId, items_extracted: items.length });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
