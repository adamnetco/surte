// GET /api/products?category=slug&search=arroz&page=1&pageSize=24
import type { APIRoute } from "astro";
import { corsPreflight, errorResponse, jsonResponse, requireTenant, supaRest } from "../../../lib/api";
import type { Product } from "../../../lib/store";

export const prerender = false;

export const OPTIONS: APIRoute = () => corsPreflight();

export const GET: APIRoute = async ({ request, url }) => {
  const t = await requireTenant(request);
  if (t instanceof Response) return t;

  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "24")));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = `products?organization_id=eq.${t.organization_id}&is_active=eq.true`;
  q += `&select=*,category:categories(slug,name)&order=name.asc`;
  if (category) q += `&category.slug=eq.${encodeURIComponent(category)}`;
  if (search) q += `&name=ilike.*${encodeURIComponent(search)}*`;

  try {
    const res = await fetch(`${import.meta.env.PUBLIC_SUPABASE_URL}/rest/v1/${q}`, {
      headers: {
        apikey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${import.meta.env.PUBLIC_SUPABASE_ANON_KEY}`,
        Range: `${from}-${to}`,
        Prefer: "count=exact",
      },
    });
    if (!res.ok) return errorResponse(res.status, "FETCH_FAILED", await res.text());
    const data = (await res.json()) as Product[];
    const contentRange = res.headers.get("content-range") ?? "";
    const totalItems = Number(contentRange.split("/")[1] ?? data.length);
    return jsonResponse({
      data,
      pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } });
  } catch (e) {
    return errorResponse(500, "FETCH_FAILED", (e as Error).message);
  }
};
