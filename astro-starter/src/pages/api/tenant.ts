import type { APIRoute } from "astro";
import { corsPreflight, jsonResponse, requireTenant } from "../../lib/api";

export const prerender = false;

export const OPTIONS: APIRoute = () => corsPreflight();

export const GET: APIRoute = async ({ request }) => {
  const t = await requireTenant(request);
  if (t instanceof Response) return t;
  return jsonResponse(t, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  });
};
