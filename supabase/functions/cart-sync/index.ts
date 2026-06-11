// Edge Function: cart-sync
// Auth-by-token endpoint that the WhatsApp Flow webhook (or any external
// integration) calls to read/upsert the cart addressed by `cart_token`.
//
// GET    ?token=<uuid>   → returns the cart payload + live stock
// POST   { cart_token, items, subtotal, total_items, phone?, channel? }
//        → upserts the cart and returns the stored row
// PATCH  { cart_token, status: 'completed' }
//        → marks the cart as completed (after order creation)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cart-token",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Etapa 27: schemas estrictos.
const Uuid = z.string().uuid();
const CartItem = z.object({
  product_id: Uuid,
  quantity: z.number().int().min(1).max(9999),
  price: z.number().min(0).max(1e9).optional(),
  name: z.string().max(300).optional(),
  presentation_id: Uuid.optional().nullable(),
}).passthrough();

const PostSchema = z.object({
  cart_token: Uuid,
  items: z.array(CartItem).max(500).default([]),
  subtotal: z.number().min(0).max(1e10).optional(),
  total_items: z.number().int().min(0).max(99999).optional(),
  phone: z.string().max(30).optional().nullable(),
  channel: z.string().max(40).optional(),
  metadata: z.record(z.string().max(60), z.any()).optional(),
});

const PatchSchema = z.object({
  cart_token: Uuid,
  status: z.enum(["completed"]),
});


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token =
        url.searchParams.get("token") || req.headers.get("x-cart-token") || "";
      if (!Uuid.safeParse(token).success) return json({ error: "invalid_token" }, 400);

      const { data, error } = await supabase.rpc("get_persistent_cart", {
        _cart_token: token,
      });
      if (error) return json({ error: error.message }, 500);
      const cart = (data || [])[0] || null;
      if (!cart) return json({ cart: null }, 404);

      const ids = Array.isArray(cart.items)
        ? cart.items.map((i: any) => i.product_id).filter(Boolean)
        : [];
      let stockMap: Record<string, number> = {};
      if (ids.length) {
        const { data: prods } = await supabase
          .from("products")
          .select("id, stock, price, is_active")
          .in("id", ids);
        (prods || []).forEach((p: any) => { stockMap[p.id] = p.stock; });
      }
      const itemsWithStock = (cart.items as any[]).map((it) => ({
        ...it,
        live_stock: stockMap[it.product_id] ?? null,
      }));

      return json({ cart: { ...cart, items: itemsWithStock } });
    }

    if (req.method === "POST") {
      const raw = await req.json().catch(() => null);
      const parsed = PostSchema.safeParse(raw);
      if (!parsed.success) {
        return json({ error: "invalid_payload", details: parsed.error.flatten() }, 400);
      }
      const body = parsed.data;
      // Etapa 23: nunca confiar en _user_id del body.
      const { error } = await supabase.rpc("upsert_persistent_cart", {
        _cart_token: body.cart_token,
        _items: body.items,
        _subtotal: body.subtotal ?? 0,
        _total_items: body.total_items ?? 0,
        _phone: body.phone ?? null,
        _user_id: null,
        _channel: body.channel ?? "web",
        _metadata: body.metadata ?? {},
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (req.method === "PATCH") {
      const raw = await req.json().catch(() => null);
      const parsed = PatchSchema.safeParse(raw);
      if (!parsed.success) {
        return json({ error: "invalid_payload", details: parsed.error.flatten() }, 400);
      }
      const { error } = await supabase.rpc("complete_persistent_cart", {
        _cart_token: parsed.data.cart_token,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "method_not_allowed" }, 405);

  } catch (e: any) {
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
