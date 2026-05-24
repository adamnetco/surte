import type { APIRoute } from "astro";

export const GET: APIRoute = ({ request }) => {
  const host = request.headers.get("host") ?? "";
  const base = `https://${host.replace(/^www\./, "")}`;
  const body = `User-agent: *
Allow: /
Disallow: /carrito
Disallow: /pedido/

Sitemap: ${base}/sitemap.xml
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
