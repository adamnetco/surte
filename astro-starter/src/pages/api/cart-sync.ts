// POST /api/cart-sync
// Proxy a la edge function cart-sync (omnichannel cart por cart_token).
// Body: { cart_token: string, items: [...], customer?: {...} }
import type { APIRoute } from "astro";
import { corsPreflight, errorResponse, jsonResponse, supaFn } from "../../lib/api";

export const prerender = false;

export const OPTIONS: APIRoute = () => corsPreflight();

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Body must be JSON");
  }
  if (!body?.cart_token || typeof body.cart_token !== "string") {
    return errorResponse(422, "VALIDATION_ERROR", "cart_token (uuid) is required");
  }
  if (!Array.isArray(body.items)) {
    return errorResponse(422, "VALIDATION_ERROR", "items[] is required");
  }
  try {
    const data = await supaFn("cart-sync", body);
    return jsonResponse({ data });
  } catch (e) {
    return errorResponse(502, "UPSTREAM_FAILED", (e as Error).message);
  }
};
