import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/xml; charset=utf-8',
};

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const baseUrl = 'https://surte.lovable.app';

  // Fetch products
  const { data: products } = await supabase
    .from('products')
    .select('slug, id, updated_at, image_url')
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  // Fetch categories
  const { data: categories } = await supabase
    .from('categories')
    .select('slug, updated_at')
    .eq('is_active', true);

  const now = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/catalogo</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;

  // Categories
  categories?.forEach((c) => {
    xml += `
  <url>
    <loc>${baseUrl}/hub/categoria/${c.slug}</loc>
    <lastmod>${c.updated_at?.split('T')[0] || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  // Products
  products?.forEach((p) => {
    const slug = p.slug || p.id;
    const lastmod = p.updated_at?.split('T')[0] || now;
    xml += `
  <url>
    <loc>${baseUrl}/producto/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${p.image_url ? `
    <image:image>
      <image:loc>${p.image_url}</image:loc>
    </image:image>` : ''}
  </url>`;
  });

  xml += `
</urlset>`;

  return new Response(xml, { headers: corsHeaders });
});
