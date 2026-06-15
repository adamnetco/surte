// GET /api/landing/:slug?scope=surteya — proxy a edge function get-landing
import type { APIRoute } from "astro";
import { corsPreflight, errorResponse, jsonResponse, requireTenant, SUPABASE_URL, supaHeaders } from "../../../lib/api";

export const prerender = false;

export const OPTIONS: APIRoute = () => corsPreflight();

export const GET: APIRoute = async ({ request, params, url }) => {
  const t = await requireTenant(request);
  if (t instanceof Response) return t;
  const slug = params.slug;
  if (!slug) return errorResponse(400, "MISSING_SLUG", "slug required");
  const scope = url.searchParams.get("scope") ?? t.slug ?? "sistecpos";
  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/get-landing?scope=${encodeURIComponent(scope)}&slug=${encodeURIComponent(slug)}`,
      { headers: supaHeaders },
    );
    if (!res.ok) return errorResponse(res.status, "UPSTREAM_FAILED", await res.text());
    const data = await res.json();
    return jsonResponse({ data }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (e) {
    return errorResponse(502, "UPSTREAM_FAILED", (e as Error).message);
  }
};
