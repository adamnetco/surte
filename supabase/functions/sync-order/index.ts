import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { order_id, webhook_url } = await req.json();

    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch order with items
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get webhook URL from settings if not provided
    let targetUrl = webhook_url;
    if (!targetUrl) {
      const { data: setting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "external_sync_webhook_url")
        .maybeSingle();
      targetUrl = setting?.value;
    }

    if (!targetUrl) {
      // No webhook configured, just mark as ready
      await supabase
        .from("orders")
        .update({
          external_sync_status: "no_webhook",
          external_sync_sent_at: new Date().toISOString(),
        })
        .eq("id", order_id);

      return new Response(
        JSON.stringify({ success: true, message: "No webhook configured, order marked" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send to external system
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
      items: order.order_items.map((item: any) => ({
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
      .eq("id", order_id);

    return new Response(
      JSON.stringify({ success: response.ok, status: syncStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
