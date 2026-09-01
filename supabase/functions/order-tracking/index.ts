import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { order_number?: unknown; tracking_token?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const orderNumber = Number(body.order_number);
  const token = String(body.tracking_token ?? "");
  if (!Number.isInteger(orderNumber)) return json({ error: "not_found" }, 404);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  let orderQuery = admin.from("orders")
    .select("id,order_number,user_id,customer_name,customer_address,total,status,notes,created_at,updated_at,subtotal,delivery_price,preferred_delivery_date,preferred_time_slot,payment_method,payment_status,amount_paid")
    .eq("order_number", orderNumber);
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    orderQuery = orderQuery.eq("tracking_token", token);
  } else {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "not_found" }, 404);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "not_found" }, 404);
    orderQuery = orderQuery.eq("user_id", userData.user.id);
  }
  const { data: order } = await orderQuery.maybeSingle();
  if (!order) return json({ error: "not_found" }, 404);

  const [itemsRes, eventsRes] = await Promise.all([
    admin.from("order_items").select("id,order_id,product_name,quantity,unit_price,total_price").eq("order_id", order.id),
    admin.from("whatsapp_message_events").select("id,order_id,status,error,created_at").eq("order_id", order.id).order("created_at"),
  ]);
  const { user_id: _ownerId, ...safeOrder } = order;
  return json({ order: { ...safeOrder, order_items: itemsRes.data ?? [] }, events: eventsRes.data ?? [] });
});