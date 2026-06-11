import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/xml; charset=utf-8',
};

const BASE_URL = 'https://surteya.com';
const CITIES = ['bucaramanga', 'floridablanca', 'giron', 'piedecuesta'];

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlNode(loc: string, lastmod: string, changefreq: string, priority: string, image?: { loc: string; title: string }): string {
  return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${image ? `
    <image:image>
      <image:loc>${image.loc}</image:loc>
      <image:title>${escapeXml(image.title)}</image:title>
    </image:image>` : ''}
  </url>`;
}

function wrapUrlset(urls: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls}
</urlset>`;
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const url = new URL(req.url);
  const format = url.searchParams.get('format');
  const type = url.searchParams.get('type'); // products|categories|brands|cities|pages|static
  const now = new Date().toISOString().split('T')[0];

  // ─── Multi-tenant: resuelve organization_id por host ──────
  // Acepta ?host=foo.com o lo deriva del Host header. Si no resuelve, hace
  // fallback al comportamiento legacy (surteya) para mantener compatibilidad.
  const requestedHost = (url.searchParams.get('host') || req.headers.get('host') || '').toLowerCase();
  let tenantOrgId: string | null = null;
  if (requestedHost) {
    try {
      const { data } = await supabase.rpc('resolve_tenant_by_host', { _host: requestedHost });
      tenantOrgId = (data as any)?.organization_id ?? null;
    } catch { /* ignore */ }
  }

  // ─── Google Merchant Center feed (RSS) ────────────────────
  if (format === 'gmc') {
    let q = supabase
      .from('products')
      .select('*, categories(name)')
      .eq('is_active', true)
      .order('name');
    if (tenantOrgId) q = q.eq('organization_id', tenantOrgId);
    const { data: products } = await q;

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
<link>${BASE_URL}</link>
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
  <g:link>${BASE_URL}/producto/${slug}</g:link>
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

  // ─── Sitemap Index ────────────────────────────────────────
  if (format === 'index') {
    const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${BASE_URL}/sitemap-static.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${BASE_URL}/sitemap-products.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${BASE_URL}/sitemap-categories.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${BASE_URL}/sitemap-brands.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${BASE_URL}/sitemap-cities.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${BASE_URL}/sitemap-pages.xml</loc><lastmod>${now}</lastmod></sitemap>
</sitemapindex>`;
    return new Response(sitemapIndex, { headers: corsHeaders });
  }

  // ─── Segmented sitemaps by ?type ──────────────────────────
  if (type === 'static') {
    const urls = [
      urlNode(`${BASE_URL}/`, now, 'daily', '1.0'),
      urlNode(`${BASE_URL}/catalogo`, now, 'daily', '0.9'),
      urlNode(`${BASE_URL}/categorias`, now, 'weekly', '0.8'),
      urlNode(`${BASE_URL}/ofertas`, now, 'daily', '0.8'),
      urlNode(`${BASE_URL}/politicas`, now, 'monthly', '0.3'),
      urlNode(`${BASE_URL}/tratamiento-datos`, now, 'monthly', '0.3'),
    ].join('');
    return new Response(wrapUrlset(urls), { headers: corsHeaders });
  }

  if (type === 'products') {
    const { data: products } = await supabase
      .from('products')
      .select('slug, id, updated_at, image_url, name')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });
    const urls = (products || []).map((p: any) => {
      const slug = p.slug || p.id;
      const lastmod = p.updated_at?.split('T')[0] || now;
      return urlNode(`${BASE_URL}/producto/${slug}`, lastmod, 'weekly', '0.7',
        p.image_url ? { loc: p.image_url, title: p.name } : undefined);
    }).join('');
    return new Response(wrapUrlset(urls), { headers: corsHeaders });
  }

  if (type === 'categories') {
    const { data: categories } = await supabase
      .from('categories')
      .select('slug, name, updated_at, og_image_url')
      .eq('is_active', true)
      .order('sort_order');

    const urls: string[] = [];
    (categories || []).forEach((c: any) => {
      const lastmod = c.updated_at?.split('T')[0] || now;
      const img = c.og_image_url ? { loc: c.og_image_url, title: c.name } : undefined;
      // Generic hub
      urls.push(urlNode(`${BASE_URL}/hub/categoria/${c.slug}`, lastmod, 'weekly', '0.8', img));
      // City-scoped friendly URLs (long-tail local SEO)
      CITIES.forEach((city) => {
        urls.push(urlNode(`${BASE_URL}/${city}/categoria/${c.slug}`, lastmod, 'weekly', '0.7', img));
      });
    });
    return new Response(wrapUrlset(urls.join('')), { headers: corsHeaders });
  }

  if (type === 'brands') {
    const { data: brands } = await supabase
      .from('brands')
      .select('slug, name, logo_url, created_at')
      .eq('is_active', true)
      .order('sort_order');
    const urls: string[] = [];
    (brands || []).forEach((b: any) => {
      const slug = b.slug || b.name.toLowerCase().replace(/\s+/g, '-');
      const lastmod = b.created_at?.split('T')[0] || now;
      const img = b.logo_url ? { loc: b.logo_url, title: b.name } : undefined;
      urls.push(urlNode(`${BASE_URL}/hub/marca/${slug}`, lastmod, 'weekly', '0.7', img));
      CITIES.forEach((city) => {
        urls.push(urlNode(`${BASE_URL}/${city}/marca/${slug}`, lastmod, 'weekly', '0.6', img));
      });
    });
    return new Response(wrapUrlset(urls.join('')), { headers: corsHeaders });
  }

  if (type === 'cities') {
    const urls: string[] = [];
    CITIES.forEach((city) => {
      urls.push(urlNode(`${BASE_URL}/hub/ciudad/${city}`, now, 'weekly', '0.7'));
      urls.push(urlNode(`${BASE_URL}/${city}`, now, 'weekly', '0.8'));
    });
    return new Response(wrapUrlset(urls.join('')), { headers: corsHeaders });
  }

  if (type === 'pages') {
    const { data: landingPages } = await supabase
      .from('landing_pages')
      .select('slug, updated_at, meta_title, image_url')
      .eq('is_active', true);
    const { data: featuredSections } = await supabase
      .from('featured_sections')
      .select('label, filter_type, filter_value, updated_at')
      .eq('is_active', true);

    const urls: string[] = [];
    (landingPages || []).forEach((lp: any) => {
      urls.push(urlNode(`${BASE_URL}/s/${lp.slug}`, lp.updated_at?.split('T')[0] || now, 'weekly', '0.8',
        lp.image_url ? { loc: lp.image_url, title: lp.meta_title || lp.slug } : undefined));
    });
    (featuredSections || []).forEach((fs: any) => {
      if (fs.filter_type === 'tag' && fs.filter_value) {
        urls.push(urlNode(`${BASE_URL}/hub/etiqueta/${fs.filter_value}`, fs.updated_at?.split('T')[0] || now, 'weekly', '0.6'));
      }
    });
    return new Response(wrapUrlset(urls.join('')), { headers: corsHeaders });
  }

  // ─── Default: full sitemap (backwards compatible) ─────────
  const [productsRes, categoriesRes, brandsRes, landingRes] = await Promise.all([
    supabase.from('products').select('slug, id, updated_at, image_url, name').eq('is_active', true).order('updated_at', { ascending: false }),
    supabase.from('categories').select('slug, name, updated_at, og_image_url').eq('is_active', true).order('sort_order'),
    supabase.from('brands').select('slug, name, logo_url, created_at').eq('is_active', true).order('sort_order'),
    supabase.from('landing_pages').select('slug, updated_at, meta_title, image_url').eq('is_active', true),
  ]);

  const allUrls: string[] = [
    urlNode(`${BASE_URL}/`, now, 'daily', '1.0'),
    urlNode(`${BASE_URL}/catalogo`, now, 'daily', '0.9'),
    urlNode(`${BASE_URL}/categorias`, now, 'weekly', '0.8'),
    urlNode(`${BASE_URL}/ofertas`, now, 'daily', '0.8'),
  ];

  (categoriesRes.data || []).forEach((c: any) => {
    const lastmod = c.updated_at?.split('T')[0] || now;
    const img = c.og_image_url ? { loc: c.og_image_url, title: c.name } : undefined;
    allUrls.push(urlNode(`${BASE_URL}/hub/categoria/${c.slug}`, lastmod, 'weekly', '0.8', img));
    CITIES.forEach((city) => {
      allUrls.push(urlNode(`${BASE_URL}/${city}/categoria/${c.slug}`, lastmod, 'weekly', '0.7', img));
    });
  });

  (brandsRes.data || []).forEach((b: any) => {
    const slug = b.slug || b.name.toLowerCase().replace(/\s+/g, '-');
    allUrls.push(urlNode(`${BASE_URL}/hub/marca/${slug}`, b.created_at?.split('T')[0] || now, 'weekly', '0.7',
      b.logo_url ? { loc: b.logo_url, title: b.name } : undefined));
  });

  CITIES.forEach((city) => {
    allUrls.push(urlNode(`${BASE_URL}/${city}`, now, 'weekly', '0.8'));
    allUrls.push(urlNode(`${BASE_URL}/hub/ciudad/${city}`, now, 'weekly', '0.7'));
  });

  (landingRes.data || []).forEach((lp: any) => {
    allUrls.push(urlNode(`${BASE_URL}/s/${lp.slug}`, lp.updated_at?.split('T')[0] || now, 'weekly', '0.8',
      lp.image_url ? { loc: lp.image_url, title: lp.meta_title || lp.slug } : undefined));
  });

  (productsRes.data || []).forEach((p: any) => {
    const slug = p.slug || p.id;
    allUrls.push(urlNode(`${BASE_URL}/producto/${slug}`, p.updated_at?.split('T')[0] || now, 'weekly', '0.7',
      p.image_url ? { loc: p.image_url, title: p.name } : undefined));
  });

  return new Response(wrapUrlset(allUrls.join('')), { headers: corsHeaders });
});
