// POST /api/lead — proxy a edge function lead-capture
import type { APIRoute } from "astro";
import { corsPreflight, errorResponse, jsonResponse, requireTenant, supaFn } from "../../lib/api";

export const prerender = false;

export const OPTIONS: APIRoute = () => corsPreflight();

export const POST: APIRoute = async ({ request }) => {
  const t = await requireTenant(request);
  if (t instanceof Response) return t;

  let body: any;
  try { body = await request.json(); } catch {
    return errorResponse(400, "INVALID_JSON", "Body must be JSON");
  }
  if (!body?.name || !body?.phone) {
    return errorResponse(422, "VALIDATION_ERROR", "name and phone required");
  }
  try {
    const data = await supaFn("lead-capture", { ...body, organization_id: t.organization_id });
    return jsonResponse({ data });
  } catch (e) {
    return errorResponse(502, "UPSTREAM_FAILED", (e as Error).message);
  }
};
