import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/xml; charset=utf-8',
};

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const baseUrl = 'https://surteya.com';

  const url = new URL(req.url);
  const format = url.searchParams.get('format');

  // Google Merchant Center Product Feed (RSS/XML)
  if (format === 'gmc') {
    const { data: products } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('is_active', true)
      .order('name');

    const { data: settingsRows } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['store_name', 'default_product_image']);
    const settings: Record<string, string> = {};
    settingsRows?.forEach((r: any) => { settings[r.key] = r.value; });

    const storeName = settings.store_name || 'SURTÉ YA';
    const defaultImg = settings.default_product_image || '';

    let feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${storeName}</title>
<link>${baseUrl}</link>
<description>Catálogo de productos ${storeName}</description>`;

    products?.forEach((p: any) => {
      const slug = p.slug || p.id;
      const imgUrl = p.image_url || defaultImg;
      const availability = p.stock > 0 ? 'in_stock' : 'out_of_stock';
      const category = p.categories?.name || 'Alimentos';
      feed += `
<item>
  <g:id>${p.id}</g:id>
  <g:title><![CDATA[${p.name}]]></g:title>
  <g:description><![CDATA[${p.description || p.name}]]></g:description>
  <g:link>${baseUrl}/producto/${slug}</g:link>
  ${imgUrl ? `<g:image_link>${imgUrl}</g:image_link>` : ''}
  <g:availability>${availability}</g:availability>
  <g:price>${p.price} COP</g:price>
  ${p.original_price ? `<g:sale_price>${p.price} COP</g:sale_price>` : ''}
  <g:brand>${p.brand || storeName}</g:brand>
  <g:condition>new</g:condition>
  <g:product_type>${category}</g:product_type>
  ${p.gtin ? `<g:gtin>${p.gtin}</g:gtin>` : '<g:identifier_exists>false</g:identifier_exists>'}
  ${p.sku ? `<g:mpn>${p.sku}</g:mpn>` : ''}
  ${p.weight ? `<g:shipping_weight>${p.weight}</g:shipping_weight>` : ''}
</item>`;
    });

    feed += `
</channel>
</rss>`;

    return new Response(feed, { headers: corsHeaders });
  }

  // Standard Sitemap
  const { data: products } = await supabase
    .from('products')
    .select('slug, id, updated_at, image_url')
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

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
  </url>
  <url>
    <loc>${baseUrl}/categorias</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/ofertas</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/politicas</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${baseUrl}/tratamiento-datos</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>`;

  categories?.forEach((c: any) => {
    xml += `
  <url>
    <loc>${baseUrl}/hub/categoria/${c.slug}</loc>
    <lastmod>${c.updated_at?.split('T')[0] || now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  products?.forEach((p: any) => {
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
