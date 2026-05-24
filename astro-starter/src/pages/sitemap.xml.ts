// Sitemap dinámico por tenant. Incluye landings activas, categorías y productos.
import type { APIRoute } from "astro";
import { resolveTenant } from "../lib/tenant";

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL!;
const ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY!;

const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };

async function rest(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) return [];
  return res.json();
}

export const GET: APIRoute = async ({ request }) => {
  const host = request.headers.get("host") ?? "";
  const tenant = await resolveTenant(host);
  const scope = tenant?.slug ?? "sistecpos";
  const orgId = tenant?.organization_id;
  const base = `https://${host.replace(/^www\./, "")}`;

  const [landings, categories, products] = await Promise.all([
    rest(`landing_pages?site_scope=eq.${scope}&is_active=eq.true&noindex=eq.false&select=slug,updated_at`),
    orgId ? rest(`categories?organization_id=eq.${orgId}&is_active=eq.true&select=slug,updated_at`) : Promise.resolve([]),
    orgId ? rest(`products?organization_id=eq.${orgId}&is_active=eq.true&select=slug,updated_at&limit=2000`) : Promise.resolve([]),
  ]);

  const urls: string[] = [];
  const push = (loc: string, lastmod?: string) =>
    urls.push(`<url><loc>${loc}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}</url>`);

  push(`${base}/`);
  push(`${base}/catalogo`);
  for (const l of landings as any[]) {
    if (["home", `${scope}-home`].includes(l.slug)) continue;
    push(`${base}/${l.slug}`, l.updated_at);
  }
  for (const c of categories as any[]) push(`${base}/categoria/${c.slug}`, c.updated_at);
  for (const p of products as any[]) push(`${base}/producto/${p.slug}`, p.updated_at);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=120",
    },
  });
};
