import type { APIRoute } from "astro";
import { listCategories } from "../../lib/store";
import { corsPreflight, errorResponse, jsonResponse, requireTenant } from "../../lib/api";

export const prerender = false;

export const OPTIONS: APIRoute = () => corsPreflight();

export const GET: APIRoute = async ({ request }) => {
  const t = await requireTenant(request);
  if (t instanceof Response) return t;
  try {
    const data = await listCategories(t.organization_id);
    return jsonResponse({ data }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (e) {
    return errorResponse(500, "FETCH_FAILED", (e as Error).message);
  }
};
