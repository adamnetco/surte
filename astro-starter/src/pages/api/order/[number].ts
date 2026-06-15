// GET /api/order/:number — usado por la página /pedido/:number para polling/refresh.
import type { APIRoute } from "astro";
import { getOrderByNumber } from "../../../lib/store";
import { corsPreflight, errorResponse, jsonResponse, requireTenant } from "../../../lib/api";

export const prerender = false;

export const OPTIONS: APIRoute = () => corsPreflight();

export const GET: APIRoute = async ({ request, params }) => {
  const t = await requireTenant(request);
  if (t instanceof Response) return t;
  const number = params.number;
  if (!number) return errorResponse(400, "MISSING_NUMBER", "order number required");
  try {
    const order = await getOrderByNumber(t.organization_id, number);
    if (!order) return errorResponse(404, "NOT_FOUND", `Order ${number} not found`);
    return jsonResponse({ data: order }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(500, "FETCH_FAILED", (e as Error).message);
  }
};
