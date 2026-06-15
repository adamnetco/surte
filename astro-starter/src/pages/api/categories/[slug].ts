import type { APIRoute } from "astro";
import { getCategoryBySlug, listProducts } from "../../../lib/store";
import { corsPreflight, errorResponse, jsonResponse, requireTenant } from "../../../lib/api";

export const prerender = false;

export const OPTIONS: APIRoute = () => corsPreflight();

export const GET: APIRoute = async ({ request, params }) => {
  const t = await requireTenant(request);
  if (t instanceof Response) return t;
  const slug = params.slug;
  if (!slug) return errorResponse(400, "MISSING_SLUG", "slug param required");
  try {
    const category = await getCategoryBySlug(t.organization_id, slug);
    if (!category) return errorResponse(404, "NOT_FOUND", `Category ${slug} not found`);
    const all = await listProducts(t.organization_id);
    const products = all.filter((p) => p.category_id === category.id);
    return jsonResponse({ data: { category, products } }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (e) {
    return errorResponse(500, "FETCH_FAILED", (e as Error).message);
  }
};
