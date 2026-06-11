// sync-order — Envía un pedido a un webhook externo (ERP de cliente).
// Etapa 16: requiere auth + membership en la organización dueña del pedido.
// El webhook URL se busca en app_settings con clave por-org:
//   external_sync_webhook_url:<organization_id>   (preferida)
//   external_sync_webhook_url                     (fallback legacy)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { order_id, webhook_url } = await req.json();
    if (!order_id) return json({ error: "order_id is required" }, 400);

    // Fetch order with items
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) return json({ error: "Order not found" }, 404);

    const orgId = (order as any).organization_id as string | null;
    if (!orgId) return json({ error: "Order has no organization_id" }, 422);

    // Membership check
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) return json({ error: "Forbidden" }, 403);

    // Resolve webhook URL — prefer org-scoped key, then legacy global
    let targetUrl = webhook_url as string | undefined;
    if (!targetUrl) {
      const { data: setOrg } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", `external_sync_webhook_url:${orgId}`)
        .maybeSingle();
      targetUrl = (setOrg?.value as any) ?? undefined;
    }
    if (!targetUrl) {
      const { data: setLegacy } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "external_sync_webhook_url")
        .maybeSingle();
      targetUrl = (setLegacy?.value as any) ?? undefined;
    }

    if (!targetUrl) {
      await supabase
        .from("orders")
        .update({
          external_sync_status: "no_webhook",
          external_sync_sent_at: new Date().toISOString(),
        })
        .eq("id", order_id)
        .eq("organization_id", orgId);

      return json({ success: true, message: "No webhook configured, order marked" });
    }

    const payload = {
      order_number: order.order_number,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_address: order.customer_address,
      subtotal: order.subtotal,
      delivery_price: order.delivery_price,
      total: order.total,
      notes: order.notes,
      status: order.status,
      organization_id: orgId,
      items: (order as any).order_items.map((item: any) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      })),
      created_at: order.created_at,
    };

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const syncStatus = response.ok ? "sent" : "failed";

    await supabase
      .from("orders")
      .update({
        external_sync_status: syncStatus,
        external_sync_sent_at: new Date().toISOString(),
      })
      .eq("id", order_id)
      .eq("organization_id", orgId);

    return json({ success: response.ok, status: syncStatus });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
