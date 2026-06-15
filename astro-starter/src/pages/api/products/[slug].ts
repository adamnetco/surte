import type { APIRoute } from "astro";
import { getProductBySlug } from "../../../lib/store";
import { corsPreflight, errorResponse, jsonResponse, requireTenant } from "../../../lib/api";

export const prerender = false;

export const OPTIONS: APIRoute = () => corsPreflight();

export const GET: APIRoute = async ({ request, params }) => {
  const t = await requireTenant(request);
  if (t instanceof Response) return t;
  const slug = params.slug;
  if (!slug) return errorResponse(400, "MISSING_SLUG", "slug param required");
  try {
    const product = await getProductBySlug(t.organization_id, slug);
    if (!product) return errorResponse(404, "NOT_FOUND", `Product ${slug} not found`);
    return jsonResponse({ data: product }, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" },
    });
  } catch (e) {
    return errorResponse(500, "FETCH_FAILED", (e as Error).message);
  }
};
